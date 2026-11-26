# 🎄 Christmas List Generator & Shopper

A local, full-featured Christmas gift list generator and shopper app with a clean single-page UI and a local JSON database.

## Features

1. **Recipient Profiles** — Name, relationship, age (if kid), interests, dislikes/allergies, dollar budget.
2. **Gift Idea Generator** — Gift suggestions tailored to each recipient within remaining budget, with reasons why it fits and shopping query/links.
3. **Shopping & Fulfillment Tracker** — Statuses: Idea → Ordered → Arrived → Wrapped, plus actual price paid and store/merchant name.
4. **Budget & Store Grouping** — Remaining budget per recipient, total spend, group unpurchased/ordered items by store and shopping run; warning badges for low budget / over budget / few gifts.
5. **Optional PIN Lock** — Hide gift lists on shared screens with a 4–6 digit PIN.
6. **Live Product Search** — `POST /api/search` using Brave Search API or SerpAPI; falls back to clean direct Google Shopping, Amazon, Target, Walmart, Best Buy, Etsy URLs.
7. **Quick-Add Parser** — Paste a product URL or note like `"Lego Star Wars set $45 Target for Leo"` → extracts item title, price, store, recipient and adds it as a gift.
8. **Status Filter Pills & Export** — Filter by All / Needs Ordering / In Transit / Needs Wrapping. Export CSV or JSON backups.

## Tech Stack

- **Backend:** Python 3.9 + Flask
- **Frontend:** Vanilla HTML/CSS/JS (single-page UI, dark theme, Google Fonts: Inter + Space Grotesk)
- **Database:** Local JSON file (`data/gifts.json`)
- **Optional:** BRAVE_API_KEY or SERPAPI_KEY from `.env` for live product search (falls back to built-in search URLs)

## Prerequisites

- Python 3.7+
- pip

## Setup

```bash
# Clone repo
git clone https://github.com/your-username/christmas-shopper.git
cd christmas-shopper

# Install dependencies
python3 -m pip install -r requirements.txt

# Optional: copy .env.example to .env and add API keys
cp .env.example .env

# Run the app
python3 app.py

# Seed sample data (optional)
curl -X POST http://localhost:5000/api/seed
```

The app will start at **http://localhost:5000**.

## Project Structure

```
christmas-shopper/
├── app.py              # Flask backend (all API routes)
├── requirements.txt    # Flask + python-dotenv
├── .env.example        # Optional API keys
├── data/
│   └── gifts.json      # Local JSON database
├── public/
│   ├── index.html     # Single-page UI
│   ├── style.css      # Dark theme styles
│   └── app.js         # Frontend logic
├── README.md
└── package.json       # Legacy Node scaffold (not used)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recipients` | List all recipients |
| POST | `/api/recipients` | Add recipient |
| PUT | `/api/recipients/<id>` | Update recipient |
| DELETE | `/api/recipients/<id>` | Delete recipient |
| GET | `/api/recipients/<id>/ideas` | Generate gift ideas for recipient |
| POST | `/api/ideas` | Add gift idea |
| PUT | `/api/ideas/<id>` | Update idea (status, price, store, url) |
| DELETE | `/api/ideas/<id>` | Delete idea |
| GET | `/api/ideas` | List all ideas (supports ?status= and ?recipientId=) |
| GET | `/api/stats` | Dashboard stats + byStore grouping |
| POST | `/api/search` | Live product search (`{"query": "..."}`) |
| POST | `/api/quick-add` | Quick add parse (`{"text": "..."}`) |
| POST | `/api/lock/set-pin` | Set PIN |
| POST | `/api/lock/unlock` | Unlock |
| POST | `/api/lock/clear-pin` | Clear PIN |
| POST | `/api/seed` | Seed sample data |
| GET | `/api/export/json` | Download JSON backup |
| GET | `/api/export/csv` | Download CSV backup |

## Quick-Add Format

```
Lego Star Wars set $45 Target for Leo
```

The parser extracts:
- **Item name:** "Lego Star Wars set"
- **Price:** $45
- **Store:** Target
- **Recipient:** Leo

Then shows a recipient picker to assign the item.

## Live Search Setup

1. Get a [Brave Search API](https://brave.com/search/api/) key or [SerpAPI](https://serpapi.com/) key.
2. Create `.env` in the project root:
   ```
   BRAVE_API_KEY=your_key_here
   SERPAPI_KEY=your_key_here
   ```
3. If no keys are set, the app falls back to clean direct search URLs for Google Shopping, Amazon, Target, Walmart, Best Buy, and Etsy.

## Running

```bash
python3 -m pip install -r requirements.txt
python3 app.py
```

Open **http://localhost:5000** in your browser.

## Data Schema (`data/gifts.json`)

```json
{
  "recipients": [
    {
      "id": "r_...",
      "name": "Sarah",
      "relationship": "Mother",
      "age": null,
      "interests": ["gardening", "cooking", "reading"],
      "dislikes": ["chocolate"],
      "allergies": ["peanuts"],
      "budget": 75.0
    }
  ],
  "ideas": [
    {
      "id": "i_...",
      "recipientId": "r_...",
      "name": "Gift Name",
      "category": "Books",
      "price": 30.0,
      "reason": "Matches interests...",
      "url": "https://...",
      "status": "Idea",
      "store": "Amazon",
      "actualPrice": null,
      "dateAdded": "2026-11-24T..."
    }
  ],
  "settings": {
    "pinHash": null
  }
}
```
