import logging
import os
import time
from typing import Any

import requests
import yfinance as yf
from dotenv import load_dotenv
from langchain_core.tools import tool

load_dotenv()

logger = logging.getLogger("finagent.tools.financial")

ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
SEC_USER_AGENT = os.getenv(
    "SEC_USER_AGENT",
    "financial-ai-agent contact@example.com",
)

# Tight defaults so a slow upstream never stalls the agent run.
HTTP_TIMEOUT_SECONDS = 10
HTTP_MAX_RETRIES = 1  # 1 means: try once, then retry once = up to 2 attempts


def _safe_get(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = HTTP_TIMEOUT_SECONDS,
    max_retries: int = HTTP_MAX_RETRIES,
) -> tuple[requests.Response | None, dict[str, Any] | None]:
    """
    Wrap requests.get with timeout + a single retry for transient failures.
    Returns (response, error_dict). On success error_dict is None.
    """
    host = _host(url)
    last_error: dict[str, Any] | None = None
    attempts = max_retries + 1
    for attempt in range(attempts):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            return r, None
        except requests.exceptions.Timeout:
            last_error = {
                "error": "Upstream request timed out",
                "host": host,
                "timeout_seconds": timeout,
            }
            logger.warning(
                "[tool] %s timed out after %ss (attempt %d/%d)",
                host, timeout, attempt + 1, attempts,
            )
        except requests.exceptions.ConnectionError as e:
            last_error = {
                "error": "Could not reach upstream",
                "host": host,
                "detail": str(e)[:200],
            }
            logger.warning(
                "[tool] %s connection error (attempt %d/%d): %s",
                host, attempt + 1, attempts, str(e)[:200],
            )
        except requests.exceptions.RequestException as e:
            last_error = {
                "error": "Upstream request failed",
                "host": host,
                "detail": str(e)[:200],
            }
            logger.warning(
                "[tool] %s request failed (attempt %d/%d): %s",
                host, attempt + 1, attempts, str(e)[:200],
            )
        if attempt < attempts - 1:
            time.sleep(0.4)
    return None, last_error


def _host(url: str) -> str:
    try:
        return url.split("//", 1)[-1].split("/", 1)[0]
    except Exception:
        return url


@tool
def yahoo_price_history(ticker: str, period: str = "1y", interval: str = "1d") -> dict:
    """
    Get historical OHLCV price data.
    Best for charts, moving averages, trend analysis.
    """
    try:
        df = yf.Ticker(ticker).history(period=period, interval=interval)
    except Exception as e:  # noqa: BLE001
        return {"error": f"Yahoo price history failed: {str(e)[:200]}", "ticker": ticker.upper()}

    if df is None or df.empty:
        return {"error": f"No price data found for {ticker}"}

    df = df.reset_index()
    df["Date"] = df["Date"].astype(str)

    return {
        "ticker": ticker.upper(),
        "source": "Yahoo Finance via yfinance",
        "data": df.to_dict(orient="records"),
    }


@tool
def yahoo_fundamentals(ticker: str) -> dict:
    """
    Get company fundamentals from Yahoo Finance.
    Best for PE ratio, market cap, revenue, margins, beta.
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}
    except Exception as e:  # noqa: BLE001
        return {"error": f"Yahoo fundamentals failed: {str(e)[:200]}", "ticker": ticker.upper()}

    return {
        "ticker": ticker.upper(),
        "source": "Yahoo Finance via yfinance",
        "data": {
            "company_name": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": info.get("marketCap"),
            "current_price": info.get("currentPrice"),
            "trailing_pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "price_to_book": info.get("priceToBook"),
            "revenue": info.get("totalRevenue"),
            "gross_profit": info.get("grossProfits"),
            "profit_margin": info.get("profitMargins"),
            "operating_margin": info.get("operatingMargins"),
            "debt_to_equity": info.get("debtToEquity"),
            "return_on_equity": info.get("returnOnEquity"),
            "beta": info.get("beta"),
            "dividend_yield": info.get("dividendYield"),
            "currency": info.get("currency"),
        },
    }


@tool
def alpha_vantage_company_overview(ticker: str) -> dict:
    """
    Get company overview/fundamentals from Alpha Vantage.
    Best for official API-style fundamental snapshot.
    Falls back gracefully if Alpha Vantage is rate-limited or slow.
    """
    if not ALPHA_VANTAGE_API_KEY:
        return {"error": "Missing ALPHA_VANTAGE_API_KEY in .env"}

    url = "https://www.alphavantage.co/query"
    params = {
        "function": "OVERVIEW",
        "symbol": ticker.upper(),
        "apikey": ALPHA_VANTAGE_API_KEY,
    }

    r, err = _safe_get(url, params=params)
    if err:
        return {**err, "ticker": ticker.upper(), "source": "Alpha Vantage"}

    try:
        data = r.json() if r is not None else {}
    except ValueError:
        return {
            "error": "Alpha Vantage returned a non-JSON response",
            "ticker": ticker.upper(),
            "source": "Alpha Vantage",
        }

    # Alpha Vantage signals throttling via a "Note" or "Information" key with full payload, no Symbol.
    if not data or "Symbol" not in data:
        return {
            "error": "No Alpha Vantage overview data returned (likely rate-limited)",
            "response": data,
            "ticker": ticker.upper(),
            "source": "Alpha Vantage",
        }

    return {
        "ticker": ticker.upper(),
        "source": "Alpha Vantage",
        "data": data,
    }


@tool
def sec_recent_filings(cik: str) -> dict:
    """
    Get recent official SEC filings by CIK.
    Best for 10-K, 10-Q, 8-K filing history.
    Example:
    Apple CIK = 0000320193
    Tesla CIK = 0001318605
    Microsoft CIK = 0000789019
    """
    cik_str = str(cik).zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{cik_str}.json"
    headers = {"User-Agent": SEC_USER_AGENT}

    r, err = _safe_get(url, headers=headers)
    if err:
        return {**err, "cik": cik_str, "source": "SEC EDGAR"}

    if r is None or r.status_code != 200:
        return {
            "error": "SEC request failed",
            "status_code": getattr(r, "status_code", None),
            "response": (getattr(r, "text", "") or "")[:300],
            "cik": cik_str,
            "source": "SEC EDGAR",
        }

    try:
        data = r.json()
    except ValueError:
        return {
            "error": "SEC returned a non-JSON response",
            "cik": cik_str,
            "source": "SEC EDGAR",
        }

    return {
        "cik": cik_str,
        "source": "SEC EDGAR",
        "company_name": data.get("name"),
        "tickers": data.get("tickers"),
        "recent_filings": data.get("filings", {}).get("recent", {}),
    }


financial_tools = [
    yahoo_price_history,
    yahoo_fundamentals,
    alpha_vantage_company_overview,
    sec_recent_filings,
]
