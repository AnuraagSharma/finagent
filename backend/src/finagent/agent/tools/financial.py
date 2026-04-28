import os
import requests
import yfinance as yf
from dotenv import load_dotenv
from langchain_core.tools import tool

load_dotenv()

ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")
SEC_USER_AGENT = os.getenv(
    "SEC_USER_AGENT",
    "financial-ai-agent contact@example.com"
)


@tool
def yahoo_price_history(ticker: str, period: str = "1y", interval: str = "1d") -> dict:
    """
    Get historical OHLCV price data.
    Best for charts, moving averages, trend analysis.
    """
    df = yf.Ticker(ticker).history(period=period, interval=interval)

    if df.empty:
        return {"error": f"No price data found for {ticker}"}

    df = df.reset_index()
    df["Date"] = df["Date"].astype(str)

    return {
        "ticker": ticker.upper(),
        "source": "Yahoo Finance via yfinance",
        "data": df.to_dict(orient="records")
    }


@tool
def yahoo_fundamentals(ticker: str) -> dict:
    """
    Get company fundamentals from Yahoo Finance.
    Best for PE ratio, market cap, revenue, margins, beta.
    """
    stock = yf.Ticker(ticker)
    info = stock.info

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
            "currency": info.get("currency")
        }
    }


@tool
def alpha_vantage_company_overview(ticker: str) -> dict:
    """
    Get company overview/fundamentals from Alpha Vantage.
    Best for official API-style fundamental snapshot.
    """
    if not ALPHA_VANTAGE_API_KEY:
        return {"error": "Missing ALPHA_VANTAGE_API_KEY in .env"}

    url = "https://www.alphavantage.co/query"

    params = {
        "function": "OVERVIEW",
        "symbol": ticker.upper(),
        "apikey": ALPHA_VANTAGE_API_KEY
    }

    r = requests.get(url, params=params, timeout=30)
    data = r.json()

    if not data or "Symbol" not in data:
        return {
            "error": "No Alpha Vantage overview data returned",
            "response": data
        }

    return {
        "ticker": ticker.upper(),
        "source": "Alpha Vantage",
        "data": data
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
    cik = str(cik).zfill(10)

    url = f"https://data.sec.gov/submissions/CIK{cik}.json"

    headers = {
        "User-Agent": SEC_USER_AGENT
    }

    r = requests.get(url, headers=headers, timeout=30)

    if r.status_code != 200:
        return {
            "error": "SEC request failed",
            "status_code": r.status_code,
            "response": r.text[:300]
        }

    data = r.json()

    return {
        "cik": cik,
        "source": "SEC EDGAR",
        "company_name": data.get("name"),
        "tickers": data.get("tickers"),
        "recent_filings": data.get("filings", {}).get("recent", {})
    }


financial_tools = [
    yahoo_price_history,
    yahoo_fundamentals,
    alpha_vantage_company_overview,
    sec_recent_filings
]