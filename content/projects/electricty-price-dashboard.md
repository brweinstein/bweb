title: Ontario Electricity Price Advisor
repo: https://github.com/brweinstein/electricity_prices
demo: https://electricity-prices-nine.vercel.app/
tags: Python, FastAPI, pandas, SQLite, Next.js, TypeScript, Tailwind
date: Aug 2026 -- Present
---

A full-stack app that tells you when Ontario electricity is cheap versus expensive, built on real hourly market data from the IESO.

![Ontario Electricity Price Advisor dashboard](/content/images/electricity-prices-dashboard.png)

## Overview

- Built a data pipeline ingesting IESO's public market price reports, reconciling two distinct pricing regimes: the legacy Hourly Ontario Energy Price (retired April 2025) and the current Ontario Price under IESO's Market Renewal Program
- Discovered a significant weekday/weekend-hour interaction effect in seasonal pricing — some hours differ by more than 100% between weekday and weekend — and used it to build a seasonality-based recommendation model
- Built a FastAPI backend that caches historical prices in SQLite and serves a `/recommendation` endpoint comparing current price against the seasonal baseline
- Built a Next.js/TypeScript/Tailwind dashboard displaying a live price readout, trend chart, and usage recommendation
- Deployed as a single Vercel project using Vercel Services, with the FastAPI backend and Next.js frontend sharing one domain
