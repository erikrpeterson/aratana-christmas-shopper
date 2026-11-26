from flask import Flask, jsonify, request, send_from_directory
from pathlib import Path
import json
import hashlib
import time
import os
import re
import urllib.request
import urllib.parse
import urllib.error
from io import StringIO
import csv

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

app = Flask(__name__, static_folder='public', static_url_path='')

BASE_DIR = Path(__file__).parent
DATA_FILE = BASE_DIR / 'data' / 'gifts.json'
PIN_LOCKED = False
LOCK_TIMEOUT = 300
last_activity = time.time()

# ---------- Gift Catalog ----------
GIFT_CATALOG = [
    {"name": "Artisan Coffee Sampler", "category": "Food & Drink", "basePrice": 25, "tags": ["coffee", "food", "drink", "gourmet"], "reason": "For the coffee lover who enjoys trying new blends"},
    {"name": "Cozy Wool Throw Blanket", "category": "Home", "basePrice": 45, "tags": ["cozy", "home", "comfort"], "reason": "Perfect for snuggling up during the winter months"},
    {"name": "Bestseller Novel Collection", "category": "Books", "basePrice": 30, "tags": ["reading", "books", "literature"], "reason": "Great for anyone who loves to get lost in a good story"},
    {"name": "Yoga Mat & Accessories Set", "category": "Fitness", "basePrice": 55, "tags": ["fitness", "yoga", "wellness", "exercise"], "reason": "Supports an active, mindful lifestyle"},
    {"name": "Gardening Tool Kit", "category": "Hobbies", "basePrice": 40, "tags": ["gardening", "outdoors", "hobbies", "plants"], "reason": "Ideal for green thumbs who love spending time outdoors"},
    {"name": "Gourmet Chocolate Box", "category": "Food & Drink", "basePrice": 20, "tags": ["chocolate", "sweets", "food", "dessert"], "reason": "A sweet treat for any occasion"},
    {"name": "Puzzle Set (1000pc)", "category": "Hobbies", "basePrice": 18, "tags": ["puzzles", "games", "brain", "family"], "reason": "Fun for the whole family on cozy nights in"},
    {"name": "Wireless Bluetooth Speaker", "category": "Tech", "basePrice": 60, "tags": ["music", "tech", "gadgets", "audio"], "reason": "Great sound for music lovers on the go"},
    {"name": "Board Game Night Bundle", "category": "Games", "basePrice": 35, "tags": ["games", "family", "fun", "kids"], "reason": "Brings everyone together for fun game nights"},
    {"name": "Plush Teddy Bear", "category": "Kids", "basePrice": 15, "tags": ["kids", "plush", "toy", "cute"], "reason": "A soft, huggable companion for little ones"},
    {"name": "LEGO Building Set", "category": "Kids", "basePrice": 50, "tags": ["kids", "building", "creative", "toy", "lego"], "reason": "Sparks creativity and hours of fun building"},
    {"name": "Coloring Book & Marker Set", "category": "Kids", "basePrice": 12, "tags": ["kids", "art", "coloring", "creative"], "reason": "Encourages artistic expression in young minds"},
    {"name": "Science Experiment Kit", "category": "Kids", "basePrice": 30, "tags": ["kids", "science", "education", "stem", "learning"], "reason": "Makes learning fun with hands-on experiments"},
    {"name": "Scented Candle Set", "category": "Home", "basePrice": 28, "tags": ["candles", "home", "cozy", "relaxation"], "reason": "Creates a warm, relaxing atmosphere at home"},
    {"name": "Cooking Class Gift Card", "category": "Experience", "basePrice": 75, "tags": ["cooking", "food", "experience", "class"], "reason": "A memorable experience for the food enthusiast"},
    {"name": "Spa Gift Basket", "category": "Self Care", "basePrice": 40, "tags": ["spa", "self-care", "relaxation", "bath"], "reason": "A pampering treat for someone who deserves relaxation"},
    {"name": "Fitness Tracker", "category": "Tech", "basePrice": 80, "tags": ["fitness", "tech", "health", "wearable"], "reason": "Helps track activity and stay motivated"},
    {"name": "Movie Night Gift Box", "category": "Food & Drink", "basePrice": 35, "tags": ["movies", "popcorn", "snacks", "cozy", "night"], "reason": "Everything needed for the perfect movie night in"},
    {"name": "Personalized Photo Frame", "category": "Personalized", "basePrice": 25, "tags": ["personalized", "photo", "memories", "home"], "reason": "A meaningful way to display cherished memories"},
    {"name": "Cookbook by Favorite Chef", "category": "Books", "basePrice": 22, "tags": ["cooking", "books", "food", "recipes"], "reason": "Inspires new culinary adventures in the kitchen"},
    {"name": "Hiking Backpack", "category": "Outdoors", "basePrice": 65, "tags": ["hiking", "outdoors", "adventure", "travel"], "reason": "Built for adventure on the trails"},
    {"name": "Waterproof Bluetooth Speaker", "category": "Tech", "basePrice": 45, "tags": ["music", "tech", "outdoors", "waterproof"], "reason": "Takes the music anywhere, even by the pool or beach"},
    {"name": "Knitting Kit", "category": "Hobbies", "basePrice": 35, "tags": ["knitting", "crafts", "hobbies", "diy"], "reason": "Perfect for crafty hands who love creating"},
    {"name": "Art Supply Set", "category": "Art", "basePrice": 40, "tags": ["art", "drawing", "painting", "creative"], "reason": "Everything an aspiring artist needs to create"},
    {"name": "Pet Lover Gift Set", "category": "Pets", "basePrice": 30, "tags": ["pets", "animals", "dog", "cat"], "reason": "For the animal lover in your life"},
    {"name": "Hot Cocoa Gift Set", "category": "Food & Drink", "basePrice": 20, "tags": ["cocoa", "hot chocolate", "cozy", "winter", "drink"], "reason": "Warm winter treat for chilly evenings"},
    {"name": "Daily Gratitude Journal", "category": "Books", "basePrice": 15, "tags": ["journal", "gratitude", "mindfulness", "writing"], "reason": "Encourages daily reflection and positivity"},
    {"name": "Plant Care Kit", "category": "Hobbies", "basePrice": 35, "tags": ["plants", "gardening", "home", "green"], "reason": "Helps keep indoor plants thriving"},
    {"name": "Wireless Earbuds", "category": "Tech", "basePrice": 70, "tags": ["tech", "audio", "music", "wireless"], "reason": "Premium sound without the tangled cords"},
    {"name": "Board Game Strategy Guide", "category": "Books", "basePrice": 18, "tags": ["games", "strategy", "books", "board games"], "reason": "Level up game night with expert tips"},
    {"name": "Kids Science Kit", "category": "Kids", "basePrice": 25, "tags": ["kids", "science", "stem", "experiments", "learning"], "reason": "Hands-on learning that makes science exciting"},
    {"name": "Stuffed Animal Collection", "category": "Kids", "basePrice": 20, "tags": ["kids", "plush", "toy", "stuffed", "cute"], "reason": "Cuddly friends for imaginative play"},
    {"name": "Outdoor Adventure Kit", "category": "Outdoors", "basePrice": 50, "tags": ["outdoors", "adventure", "hiking", "camping"], "reason": "Ready for any outdoor adventure"},
    {"name": "Gourmet Tea Collection", "category": "Food & Drink", "basePrice": 30, "tags": ["tea", "gourmet", "drink", "food", "relaxation"], "reason": "A soothing collection for tea enthusiasts"},
    {"name": "Smart Home Device", "category": "Tech", "basePrice": 50, "tags": ["tech", "smart home", "gadgets", "home"], "reason": "Makes everyday life a little easier"},
    {"name": "Baking Kit for Kids", "category": "Kids", "basePrice": 22, "tags": ["kids", "baking", "cooking", "creative", "fun"], "reason": "Fun kitchen adventures for little chefs"},
    {"name": "DIY Craft Kit", "category": "Hobbies", "basePrice": 28, "tags": ["crafts", "diy", "creative", "art", "hobbies"], "reason": "Unleash creativity with hands-on projects"},
    {"name": "Weighted Blanket", "category": "Home", "basePrice": 55, "tags": ["cozy", "home", "comfort", "sleep", "relaxation"], "reason": "Promotes relaxation and better sleep"},
    {"name": "Cookbook Collection", "category": "Books", "basePrice": 35, "tags": ["cooking", "books", "food", "recipes", "kitchen"], "reason": "Inspires new dishes and kitchen creativity"},
    {"name": "Fitness Dumbbell Set", "category": "Fitness", "basePrice": 45, "tags": ["fitness", "exercise", "gym", "health", "workout"], "reason": "Perfect for home workouts and strength training"},
    {"name": "Kids Art Supply Box", "category": "Kids", "basePrice": 18, "tags": ["kids", "art", "creative", "drawing", "coloring"], "reason": "Endless creative fun for young artists"},
    {"name": "Personalized Mug", "category": "Personalized", "basePrice": 16, "tags": ["personalized", "mug", "coffee", "gift"], "reason": "A thoughtful, practical daily reminder of your love"},
    {"name": "Music Streaming Subscription", "category": "Tech", "basePrice": 10, "tags": ["music", "streaming", "subscription", "audio"], "reason": "Endless music for every mood and moment"},
    {"name": "Garden Flower Seeds Collection", "category": "Hobbies", "basePrice": 12, "tags": ["gardening", "flowers", "plants", "outdoors", "seeds"], "reason": "Brings color and life to any garden"},
    {"name": "Comic Book Collection", "category": "Books", "basePrice": 25, "tags": ["comics", "books", "superhero", "reading"], "reason": "Epic adventures for the comic book fan"},
    {"name": "Yoga Block & Strap Set", "category": "Fitness", "basePrice": 20, "tags": ["yoga", "fitness", "wellness", "stretching"], "reason": "Deepens practice and improves flexibility"},
    {"name": "Kids Building Blocks", "category": "Kids", "basePrice": 30, "tags": ["kids", "building", "creative", "blocks", "toy"], "reason": "Imaginative construction play for growing minds"},
    {"name": "Gourmet Spice Collection", "category": "Food & Drink", "basePrice": 28, "tags": ["spices", "cooking", "food", "gourmet", "kitchen"], "reason": "Elevates every dish with premium flavors"},
    {"name": "Photo Album Scrapbook", "category": "Personalized", "basePrice": 22, "tags": ["personalized", "photos", "memories", "scrapbook"], "reason": "A beautiful way to preserve precious memories"},
    {"name": "Hiking Boots", "category": "Outdoors", "basePrice": 85, "tags": ["hiking", "outdoors", "shoes", "adventure", "boots"], "reason": "Sturdy, comfortable footwear for every trail"},
]

STATUSES = ["Idea", "Ordered", "Arrived", "Wrapped"]

# ---------- Data helpers ----------
def load_data():
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {"recipients": [], "ideas": []}

def save_data(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

db = load_data()

# ---------- PIN Lock ----------
def hash_pin(pin):
    return hashlib.sha256(str(pin).encode()).hexdigest()

def check_pin(pin):
    stored = db.get('settings', {}).get('pinHash')
    return stored is not None and hash_pin(str(pin)) == stored

@app.post('/api/lock/set-pin')
def set_pin():
    global PIN_LOCKED
    pin = request.json.get('pin', '') if request.json else ''
    if not (isinstance(pin, str) and 4 <= len(pin.strip()) <= 6 and pin.strip().isdigit()):
        return jsonify({"success": False, "error": "PIN must be 4-6 digits"}), 400
    db.setdefault('settings', {})['pinHash'] = hash_pin(pin)
    save_data(db)
    PIN_LOCKED = True
    return jsonify({"success": True})

@app.post('/api/lock/unlock')
def unlock():
    pin = (request.json or {}).get('pin', '') if request.json else ''
    if check_pin(pin):
        return jsonify({"unlocked": True})
    return jsonify({"unlocked": False}), 401

@app.post('/api/lock/clear-pin')
def clear_pin():
    global PIN_LOCKED
    db.setdefault('settings', {})['pinHash'] = None
    save_data(db)
    PIN_LOCKED = False
    return jsonify({"success": True})

# ---------- Recipients ----------
@app.get('/api/recipients')
def list_recipients():
    return jsonify(db.get('recipients', []))

@app.post('/api/recipients')
def create_recipient():
    data = request.json or {}
    name = str(data.get('name') or '').strip()
    relationship = str(data.get('relationship') or '').strip()
    if not name or not relationship:
        return jsonify({"error": "Name and relationship are required"}), 400
    recipient = {
        "id": f"r_{int(time.time())}_{abs(hash(name+relationship)) % 100000}",
        "name": name,
        "relationship": relationship,
        "age": int(data.get('age')) if data.get('age') else None,
        "interests": [str(x) for x in (data.get('interests') or [])],
        "dislikes": [str(x) for x in (data.get('dislikes') or [])],
        "allergies": [str(x) for x in (data.get('allergies') or [])],
        "budget": float(data.get('budget') or 0),
    }
    db.setdefault('recipients', []).append(recipient)
    save_data(db)
    return jsonify(recipient), 201

@app.put('/api/recipients/<recipient_id>')
def update_recipient(recipient_id):
    r = next((r for r in db.get('recipients', []) if r['id'] == recipient_id), None)
    if not r:
        return jsonify({"error": "Not found"}), 404
    data = request.json or {}
    if data.get('name'): r['name'] = str(data['name']).strip()
    if data.get('relationship'): r['relationship'] = str(data['relationship']).strip()
    if data.get('age') is not None: r['age'] = int(data.get('age'))
    if data.get('interests') is not None: r['interests'] = [str(x) for x in data.get('interests') or []]
    if data.get('dislikes') is not None: r['dislikes'] = [str(x) for x in data.get('dislikes') or []]
    if data.get('allergies') is not None: r['allergies'] = [str(x) for x in data.get('allergies') or []]
    if data.get('budget') is not None: r['budget'] = float(data.get('budget'))
    save_data(db)
    return jsonify(r)

@app.delete('/api/recipients/<recipient_id>')
def delete_recipient(recipient_id):
    db['recipients'] = [r for r in db.get('recipients', []) if r['id'] != recipient_id]
    db['ideas'] = [i for i in db.get('ideas', []) if i.get('recipientId') != recipient_id]
    save_data(db)
    return jsonify({"success": True})

# ---------- Gift Ideas ----------
@app.get('/api/recipients/<recipient_id>/ideas')
def get_ideas_for(recipient_id):
    r = next((r for r in db.get('recipients', []) if r['id'] == recipient_id), None)
    if not r:
        return jsonify({"error": "Not found"}), 404
    # Exclude gifts already in the list
    existing_names = [i.get('name', '') for i in db.get('ideas', []) if i.get('recipientId') == recipient_id]
    ideas = generate_ideas_for(r, exclude_names=existing_names)
    return jsonify({"ideas": ideas, "remainingBudget": remaining_budget(r)})

@app.post('/api/ideas')
def add_idea():
    data = request.json or {}
    recipient_id = data.get('recipientId')
    if not recipient_id:
        return jsonify({"error": "recipientId required"}), 400
    r = next((r for r in db.get('recipients', []) if r['id'] == recipient_id), None)
    if not r:
        return jsonify({"error": "Recipient not found"}), 404

    name = str(data.get('name') or 'Gift').strip()
    existing = next((i for i in db.get('ideas', []) if i.get('recipientId') == recipient_id and i.get('name', '').lower() == name.lower()), None)
    if existing:
        return jsonify({"error": "duplicate", "message": f'Gift "{name}" already exists for this recipient', "idea": existing}), 409

    idea = {
        "id": f"i_{int(time.time())}_{abs(hash(name)) % 100000}",
        "recipientId": recipient_id,
        "name": name,
        "category": data.get('category') or 'Other',
        "price": float(data.get('price') or 0),
        "reason": data.get('reason') or '',
        "query": data.get('query') or f"https://www.google.com/search?q={name}",
        "url": data.get('url') or f"https://www.google.com/search?q={name}",
        "status": "Idea",
        "store": data.get('store') or None,
        "actualPrice": data.get('actualPrice') if data.get('actualPrice') is not None else None,
        "dateAdded": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    db.setdefault('ideas', []).append(idea)
    save_data(db)
    return jsonify(idea), 201

@app.put('/api/ideas/<idea_id>')
def update_idea(idea_id):
    idea = next((i for i in db.get('ideas', []) if i['id'] == idea_id), None)
    if not idea:
        return jsonify({"error": "Not found"}), 404
    data = request.json or {}
    if data.get('name'): idea['name'] = str(data['name']).strip()
    if data.get('category'): idea['category'] = data.get('category')
    if data.get('price') is not None: idea['price'] = float(data.get('price'))
    if data.get('reason') is not None: idea['reason'] = data.get('reason')
    if data.get('status'): idea['status'] = data.get('status')
    if data.get('store') is not None: idea['store'] = data.get('store')
    if data.get('actualPrice') is not None: idea['actualPrice'] = float(data.get('actualPrice'))
    if data.get('query') is not None: idea['query'] = data.get('query')
    if data.get('url') is not None: idea['url'] = data.get('url')
    save_data(db)
    return jsonify(idea)

@app.get('/api/ideas')
def list_ideas():
    """Return all ideas, optionally filtered by ?status= and ?recipientId="""
    ideas = db.get('ideas', [])
    status = request.args.get('status')
    recipient_id = request.args.get('recipientId')
    if status:
        ideas = [i for i in ideas if i.get('status') == status]
    if recipient_id:
        ideas = [i for i in ideas if i.get('recipientId') == recipient_id]
    return jsonify(ideas)

@app.delete('/api/ideas/<idea_id>')
def delete_idea(idea_id):
    db['ideas'] = [i for i in db.get('ideas', []) if i['id'] != idea_id]
    save_data(db)
    return jsonify({"success": True})

# ---------- Stats ----------
def _compute_spent(ideas):
    """Return total spent amount counting only non-Idea gifts."""
    return sum(float(i.get('actualPrice') or i.get('price') or 0) for i in ideas if i.get('status') != 'Idea')

def _compute_spent_by_recipient(recipients, ideas):
    """Return dict mapping recipient id to spent amount (non-Idea gifts only)."""
    spent_by = {}
    for r in recipients:
        spent_by[r['id']] = sum(
            float(i.get('actualPrice') or i.get('price') or 0)
            for i in ideas
            if i.get('recipientId') == r['id'] and i.get('status') != 'Idea'
        )
    return spent_by

@app.get('/api/stats')
def get_stats():
    recipients = db.get('recipients', [])
    ideas = db.get('ideas', [])
    total_budget = sum(float(r.get('budget') or 0) for r in recipients)
    total_spend = _compute_spent(ideas)
    remaining = total_budget - total_spend
    ordered_count = sum(1 for i in ideas if i.get('status') == 'Ordered')
    wrapped_count = sum(1 for i in ideas if i.get('status') == 'Wrapped')
    by_store = {}
    for i in ideas:
        if i.get('status') != 'Idea' and i.get('store'):
            store = i.get('store')
            if store not in by_store:
                by_store[store] = {"items": [], "total": 0}
            by_store[store]["items"].append(i)
            by_store[store]["total"] += float(i.get('actualPrice') or i.get('price') or 0)
    spent_by_recipient = _compute_spent_by_recipient(recipients, ideas)
    return jsonify({
        "totalBudget": total_budget,
        "totalSpend": total_spend,
        "remaining": max(0, remaining),
        "ideasCount": len(ideas),
        "orderedCount": ordered_count,
        "wrappedCount": wrapped_count,
        "byStore": by_store,
        "byRecipient": spent_by_recipient,
    })

# ---------- Ideas Generation ----------
def get_age_band(age):
    """Classify recipient into an age band for gift matching."""
    if age is None:
        return "adult"
    if age <= 5:
        return "toddler"
    if age <= 12:
        return "kid"
    if age <= 17:
        return "teen"
    if age <= 25:
        return "young_adult"
    return "adult"


def age_band_score(gift, band):
    """Score a gift for a given age band. Higher is better."""
    tags = [t.lower() for t in gift.get('tags', [])]
    name = gift.get('name', '').lower()
    cat = gift.get('category', '').lower()

    # Age-specific tag boosts
    teen_tags = ['teen', 'music', 'tech', 'gaming', 'streaming', 'headphones', 'earbuds',
                 'wireless', 'speaker', 'smart', 'wearable', 'audio', 'comic', 'book',
                 'art', 'creative', 'fitness', 'fashion', 'self-care', 'spa', 'journal',
                 'experience', 'gift card', 'subscription', 'cosmetic']
    kid_tags = ['kids', 'plush', 'toy', 'stuffed', 'cute', 'building', 'blocks', 'lego',
                'coloring', 'science kit', 'stem', 'experiments', 'adventure kit', 'baking kit']
    toddler_tags = ['plush', 'stuffed', 'cute', 'toy', 'blocks', 'coloring']
    adult_tags = ['home', 'cozy', 'cooking', 'gourmet', 'food', 'drink', 'coffee', 'tea',
                  'spa', 'self-care', 'relaxation', 'journal', 'garden', 'outdoors',
                  'hiking', 'fitness', 'cookbook', 'recipe', 'personalized', 'photo',
                  'memories', 'smart home', 'tech', 'gadget', 'experience']

    # Base scores per band
    band_boosts = {
        'toddler': (toddler_tags, kid_tags, teen_tags, adult_tags),
        'kid': (kid_tags, toddler_tags, teen_tags, adult_tags),
        'teen': (teen_tags, kid_tags, adult_tags, []),
        'young_adult': (teen_tags, adult_tags, kid_tags, []),
        'adult': (adult_tags, teen_tags, kid_tags, []),
    }
    primary, secondary, tertiary, _ = band_boosts.get(band, (adult_tags, teen_tags, kid_tags, []))

    score = 0
    # Primary band: strong boost
    if any(t in tags or t in name or t in cat for t in primary):
        score += 4
    # Secondary band: mild boost
    if any(t in tags or t in name or t in cat for t in secondary):
        score += 1
    # Tertiary band: neutral
    if any(t in tags or t in name or t in cat for t in tertiary):
        score += 0

    # Penalties: wrong age band
    if band == 'adult' and any(t in tags for t in kid_tags + toddler_tags):
        score -= 8
    if band == 'teen' and any(t in tags for t in toddler_tags):
        score -= 6
    if band == 'kid' and any(t in tags for t in adult_tags):
        score -= 4

    # Special: explicit "kids" category is bad for teens/adults
    if band in ('teen', 'adult') and cat == 'kids':
        score -= 10

    return score


def generate_ideas_for(recipient, exclude_names=None):
    """Generate gift ideas for a recipient, excluding any names in exclude_names."""
    exclude = set(n.lower() for n in (exclude_names or []))
    remaining = remaining_budget(recipient)
    tags = [str(t).lower() for t in (recipient.get('interests') or [])]
    dislikes = [str(d).lower() for d in (recipient.get('dislikes') or [])]
    allergies = [str(a).lower() for a in (recipient.get('allergies') or [])]
    band = get_age_band(recipient.get('age'))

    scored = []
    for g in GIFT_CATALOG:
        if g['name'].lower() in exclude:
            continue
        score = 0
        g_tags = [t.lower() for t in g.get('tags', [])]

        # Interest matching (strongest signal)
        for t in tags:
            if any(t in gt or gt in t for gt in g_tags):
                score += 3

        # Age-band matching
        score += age_band_score(g, band)

        # Dislike/allergy penalties
        hay = (g.get('name', '') + ' ' + ' '.join(g_tags)).lower()
        for d in dislikes + allergies:
            if d in hay:
                score -= 10

        # Budget fit
        if g.get('basePrice', 0) <= remaining:
            score += 2
        else:
            score -= 5

        # Small variety bonus
        if g.get('category') in ('Books', 'Food & Drink'):
            score += 0.5

        scored.append((score, g))

    scored.sort(key=lambda x: -x[0])
    selected = []
    used_categories = set()
    for score, g in scored:
        if len(selected) >= 4:
            break
        if g.get('category') not in used_categories:
            selected.append(g)
            used_categories.add(g.get('category'))
    for score, g in scored:
        if len(selected) >= 4:
            break
        if not any(s['name'] == g['name'] for s in selected):
            selected.append(g)
            used_categories.add(g.get('category'))

    return [
        {
            "id": f"i_{int(time.time())}_{abs(hash(recipient['id']+str(i)+g['name'])) % 100000}",
            "recipientId": recipient['id'],
            "name": g['name'],
            "category": g['category'],
            "price": g['basePrice'],
            "reason": g['reason'] + (f" — matches interest in {', '.join(g['tags'])}" if g['tags'] else ""),
            "query": f"https://www.google.com/search?q={g['name']} buy",
            "url": f"https://www.google.com/search?q={g['name']} buy",
            "status": "Idea",
            "store": None,
            "actualPrice": None,
            "dateAdded": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        for i, g in enumerate(selected)
    ]

def remaining_budget(recipient):
    spent = sum(float(i.get('actualPrice') or i.get('price') or 0) for i in db.get('ideas', []) if i.get('recipientId') == recipient.get('id') and i.get('status') != 'Idea')
    return max(0, float(recipient.get('budget') or 0) - spent)

# ---------- Live Product Search ----------
def search_brave(query):
    """Search using Brave Search API"""
    api_key = os.environ.get('BRAVE_API_KEY')
    if not api_key:
        return None
    try:
        url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(query)}&count=10"
        req = urllib.request.Request(url, headers={'Accept': 'application/json', 'X-Subscription-Token': api_key})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            results = []
            for item in data.get('web', {}).get('results', [])[:8]:
                results.append({
                    "title": item.get('title', ''),
                    "url": item.get('url', ''),
                    "snippet": item.get('description', ''),
                    "source": "Brave"
                })
            return results
    except Exception:
        return None

def search_serpapi(query):
    """Search using SerpAPI"""
    api_key = os.environ.get('SERPAPI_KEY')
    if not api_key:
        return None
    try:
        url = f"https://serpapi.com/search.json?q={urllib.parse.quote(query)}&api_key={api_key}&engine=google_shopping&num=8"
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            # Check for rate limit / quota exceeded
            if 'error' in data:
                error_msg = data['error']
                if 'rate' in error_msg.lower() or 'quota' in error_msg.lower() or 'limit' in error_msg.lower():
                    return {"rate_limited": True, "message": f"SerpAPI quota exceeded: {error_msg}"}
            results = []
            for item in data.get('shopping_results', [])[:8]:
                results.append({
                    "title": item.get('title', ''),
                    "url": item.get('product_link', item.get('link', '')),
                    "price": item.get('price', ''),
                    "source": item.get('source', 'Shopping'),
                    "snippet": item.get('snippet', '')
                })
            return results
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return {"rate_limited": True, "message": "SerpAPI rate limit exceeded (429)"}
        if e.code == 401:
            return {"rate_limited": True, "message": "SerpAPI invalid API key (401)"}
        return None
    except Exception:
        return None

def get_store_price_range(query_lower, store):
    """Estimate price range per retailer based on typical online pricing."""
    base = query_lower
    # Amazon: wide new/used range
    if store in ('Amazon', 'amazon'):
        return "$15–$120"
    # Target: mid-range family retailer
    if store in ('Target', 'target'):
        return "$10–$60"
    # Walmart: value pricing
    if store in ('Walmart', 'walmart'):
        return "$8–$40"
    # Best Buy: electronics/tech
    if store in ('Best Buy', 'best buy'):
        return "$20–$200"
    # Etsy: handmade/vintage, wide variance
    if store in ('Etsy', 'etsy'):
        return "$15–$150"
    # Google Shopping: aggregation, can't estimate well
    return "$15–$80"

def generate_fallback_results(query):
    """Generate clean direct search URLs for major retailers with estimated price ranges"""
    encoded = urllib.parse.quote(query)
    ql = query.lower()
    store_ranges = {
        'amazon': "$15–$120",
        'target': "$10–$60",
        'walmart': "$8–$40",
        'best buy': "$20–$200",
        'etsy': "$15–$150",
    }

    # Determine price range per store
    prices = {}
    for store_key in ['amazon', 'target', 'walmart', 'best buy', 'etsy']:
        prices[store_key] = get_store_price_range(ql, store_key)

    default_range = "$15–$80"

    return [
        {
            "title": f"Google Shopping: {query}",
            "url": f"https://www.google.com/search?q={encoded}&tbm=shop",
            "snippet": "Compare prices across retailers",
            "source": "Google Shopping",
            "price": default_range,
        },
        {
            "title": f"Amazon: {query}",
            "url": f"https://www.amazon.com/s?k={encoded}",
            "snippet": "Shop on Amazon",
            "source": "Amazon",
            "price": prices.get('amazon', default_range),
        },
        {
            "title": f"Target: {query}",
            "url": f"https://www.target.com/s?searchTerm={encoded}",
            "snippet": "Shop at Target",
            "source": "Target",
            "price": prices.get('target', default_range),
        },
        {
            "title": f"Walmart: {query}",
            "url": f"https://www.walmart.com/search?q={encoded}",
            "snippet": "Shop at Walmart",
            "source": "Walmart",
            "price": prices.get('walmart', default_range),
        },
        {
            "title": f"Best Buy: {query}",
            "url": f"https://www.bestbuy.com/site/searchpage.jsp?st={encoded}",
            "snippet": "Shop at Best Buy",
            "source": "Best Buy",
            "price": prices.get('best buy', default_range),
        },
        {
            "title": f"Etsy: {query}",
            "url": f"https://www.etsy.com/search?q={encoded}",
            "snippet": "Handmade & unique gifts",
            "source": "Etsy",
            "price": prices.get('etsy', default_range),
        }
    ]

@app.post('/api/search')
def search_products():
    data = request.json or {}
    query = data.get('query', '').strip()
    if not query:
        return jsonify({"results": [], "rateLimited": False})

    # Try API-based search first
    results = search_brave(query) or search_serpapi(query)

    rate_limited = False
    rate_message = None

    if results and results.get("rate_limited"):
        rate_limited = True
        rate_message = results.get("message", "API limit reached")
        results = None

    # Fall back to generated URLs
    if not results:
        results = generate_fallback_results(query)

    return jsonify({
        "results": results,
        "rateLimited": rate_limited,
        "rateMessage": rate_message,
        "source": "api" if (not rate_limited and results and results[0].get('source') != 'Google Shopping') else "fallback",
    })

# ---------- Price Helpers ----------
def parse_price_string(s):
    """Parse a price string like '$49.99', '49.99', '$1,299.00', '€1.234,56' etc.
    Returns float or None. Only strips currency symbols — callers handle ranges separately."""
    if s is None:
        return None
    if isinstance(s, bool):
        return None
    if isinstance(s, (int, float)):
        return float(s)
    text = str(s).strip()
    if not text:
        return None
    # Remove currency symbols
    for sym in ['$', '€', '£', '¥', 'US$']:
        text = text.replace(sym, '')
    text = text.strip()
    if not text:
        return None
    m = re.search(r'(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)', text)
    if m:
        n = float(m[1].replace(',', ''))
        return n
    m = re.search(r'(\d+\.\d{1,2})', text)
    if m:
        return float(m[1])
    m = re.search(r'(\d+)', text)
    if m:
        return float(m[1])
    return None

def extract_price_from_results(results):
    """Return a single numeric price from search results, preferring real prices.
    Each result is a dict like {title, url, price, source, snippet}.
    Returns None if no usable price found."""
    if not results:
        return None
    for r in results:
        price_val = r.get('price')
        if price_val is None:
            continue
        p = parse_price_string(price_val)
        if p is not None:
            return p
    return None

def search_for_price(query):
    """Search behind the scenes for a product price.
    Returns (price_or_None, best_result_or_None).
    Only returns a price when SerpAPI provides real shopping results.
    Falls back to None (no price) when only generic search URLs are available."""
    # SerpAPI gives real shopping results with prices
    api_key = os.environ.get('SERPAPI_KEY')
    if api_key:
        try:
            url = f"https://serpapi.com/search.json?q={urllib.parse.quote(query)}&api_key={api_key}&engine=google_shopping&num=8"
            req = urllib.request.Request(url, headers={'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                if not data.get('error'):
                    results = []
                    for item in data.get('shopping_results', [])[:8]:
                        results.append({
                            "title": item.get('title', ''),
                            "url": item.get('product_link', item.get('link', '')),
                            "price": item.get('price', ''),
                            "source": item.get('source', 'Shopping'),
                            "snippet": item.get('snippet', '')
                        })
                    price = extract_price_from_results(results)
                    if price is not None:
                        return price, results[0]
        except Exception:
            pass

    # No SerpAPI or no real prices found — don't fabricate a price from
    # fallback ranges (they're coarse estimates like "$15–$80" for everything).
    # Return None so the caller can decide (e.g., leave price as 0 for manual entry).
    return None, None

# ---------- Quick-Add Parser ----------
def parse_quick_add(text):
    """Parse natural language like 'Lego Star Wars set $45 Target for Leo'"""
    text = text.strip()
    if not text:
        return None

    # Extract price
    price_match = re.search(r'\$?(\d+(?:\.\d{1,2})?)', text)
    price = float(price_match.group(1)) if price_match else None
    if price_match:
        text = text[:price_match.start()] + text[price_match.end():]

    # Extract store (known retailers)
    stores = ['amazon', 'target', 'walmart', 'best buy', 'etsy', 'costco', 'kohl', 'macys', 'nordstrom', 'sephora', 'apple', 'google store', 'microsoft store', 'game stop', 'gamestop', 'barnes and noble', 'barnes & noble', 'home depot', 'lowes', 'ikea', 'wayfair', 'overstock']
    store = None
    store_lower = text.lower()
    for s in sorted(stores, key=len, reverse=True):
        if s in store_lower:
            store = s.title()
            text = text[:store_lower.index(s)] + text[store_lower.index(s) + len(s):]
            break

    # Extract "for [name]" at the end
    recipient_name = None
    for_match = re.search(r'\bfor\s+([A-Za-z][A-Za-z\s]+?)(?:\s*$)', text, re.IGNORECASE)
    if for_match:
        recipient_name = for_match.group(1).strip()
        text = text[:for_match.start()].strip()

    # What's left is the item name
    name = re.sub(r'\s+', ' ', text).strip().strip('.,;')
    if not name:
        name = "Gift"

    return {
        "name": name,
        "price": price,
        "store": store,
        "recipient_name": recipient_name
    }

def find_recipient_by_name(name):
    if not name:
        return None
    name_lower = name.lower()
    for r in db.get('recipients', []):
        if r['name'].lower() == name_lower or r['name'].lower().startswith(name_lower):
            return r
    return None

@app.post('/api/quick-add')
def quick_add():
    data = request.json or {}
    text = data.get('text', '').strip()
    if not text:
        return jsonify({"error": "Text required"}), 400

    parsed = parse_quick_add(text)
    if not parsed:
        return jsonify({"error": "Could not parse"}), 400

    # Find recipient
    recipient = find_recipient_by_name(parsed['recipient_name']) if parsed['recipient_name'] else None
    if not recipient:
        return jsonify({"error": "Recipient not found", "parsed": parsed, "recipients": [r['name'] for r in db.get('recipients', [])]}), 404

    price = parsed['price']
    searched_price = None
    search_note = ''
    # If no price was given in the text, do a behind-the-scenes search
    # to populate the gift amount before creating the idea.
    if price is None:
        searched_price, best_result = search_for_price(parsed['name'])
        if searched_price is not None:
            price = searched_price
            search_note = ' — amount populated via search'
            # Use the searched product URL as the link if we have one
            if best_result and best_result.get('url'):
                idea_query = best_result['url']
                idea_url = best_result['url']
                idea_store = best_result.get('source') or parsed['store']
            else:
                idea_query = f"https://www.google.com/search?q={urllib.parse.quote(parsed['name'])}"
                idea_url = idea_query
                idea_store = parsed['store']
        else:
            price = 0
            idea_query = f"https://www.google.com/search?q={urllib.parse.quote(parsed['name'])}"
            idea_url = idea_query
            idea_store = parsed['store']
    else:
        idea_query = f"https://www.google.com/search?q={urllib.parse.quote(parsed['name'])}"
        idea_url = idea_query
        idea_store = parsed['store']

    # Create idea
    idea = {
        "id": f"i_{int(time.time())}_{abs(hash(parsed['name'])) % 100000}",
        "recipientId": recipient['id'],
        "name": parsed['name'],
        "category": "Quick Add",
        "price": price or 0,
        "reason": "Added via Quick-Add" + search_note,
        "query": idea_query,
        "url": idea_url,
        "status": "Idea",
        "store": idea_store,
        "actualPrice": price if price not in (None, 0) else None,
        "dateAdded": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    db.setdefault('ideas', []).append(idea)
    save_data(db)
    return jsonify({"success": True, "idea": idea, "recipient": recipient['name']})

# ---------- Export ----------
@app.get('/api/export/json')
def export_json():
    data = {
        "recipients": db.get('recipients', []),
        "ideas": db.get('ideas', []),
        "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "version": "1.0"
    }
    resp = jsonify(data)
    resp.headers['Content-Disposition'] = 'attachment; filename=christmas-list.json'
    resp.headers['Content-Type'] = 'application/json'
    return resp

@app.get('/api/export/csv')
def export_csv():
    recipients = db.get('recipients', [])
    ideas = db.get('ideas', [])
    recipient_map = {r['id']: r for r in recipients}

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['Recipient', 'Relationship', 'Age', 'Budget', 'Gift Name', 'Category', 'Estimated Price', 'Actual Price', 'Store', 'Status', 'Reason', 'Date Added'])

    for idea in ideas:
        r = recipient_map.get(idea.get('recipientId'))
        writer.writerow([
            r['name'] if r else '',
            r['relationship'] if r else '',
            r['age'] if r else '',
            r['budget'] if r else '',
            idea.get('name', ''),
            idea.get('category', ''),
            idea.get('price', ''),
            idea.get('actualPrice', ''),
            idea.get('store', ''),
            idea.get('status', ''),
            idea.get('reason', ''),
            idea.get('dateAdded', '')
        ])

    resp = app.response_class(output.getvalue(), mimetype='text/csv')
    resp.headers['Content-Disposition'] = 'attachment; filename=christmas-list.csv'
    return resp

# ---------- Seed ----------
@app.post('/api/seed')
def seed():
    global db
    db = {
        "recipients": [
            {"id": f"r_seed_1", "name": "Sarah", "relationship": "Mother", "age": None, "interests": ["gardening", "cooking", "reading"], "dislikes": ["chocolate"], "allergies": ["peanuts"], "budget": 75.0},
            {"id": f"r_seed_2", "name": "Timmy", "relationship": "Son", "age": 8, "interests": ["lego", "science", "space"], "dislikes": [], "allergies": [], "budget": 40.0},
            {"id": f"r_seed_3", "name": "Jake", "relationship": "Brother", "age": None, "interests": ["hiking", "music", "tech"], "dislikes": ["candy"], "allergies": [], "budget": 60.0},
            {"id": f"r_seed_4", "name": "Emma", "relationship": "Friend", "age": None, "interests": ["yoga", "art", "cozy"], "dislikes": [], "allergies": ["shellfish"], "budget": 30.0},
        ],
        "ideas": [],
        "settings": {},
    }
    save_data(db)
    return jsonify({"success": True, "count": len(db['recipients'])})

# ---------- Serve frontend ----------
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.after_request
def add_cache_headers(resp):
    if request.path.startswith('/api'):
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return resp

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)