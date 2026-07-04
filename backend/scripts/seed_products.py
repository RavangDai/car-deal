"""Seed ~100 demo products with 180-day synthetic price histories so the
deals feed, charts, and deal-math badges have something to show on day one.

Seeded products live under the `.example` TLD and get `status="demo"` —
both the beat fan-out (`prices.schedule_rechecks`) and the deals feed
already special-case this, so demo data is never re-scraped and reads
naturally alongside real tracked products.

History generation is deterministic (`random.Random(seed_string)` per
product), covering four patterns:
  - short_history: <14 days tracked, to exercise the "score unlocks after
    2 weeks" UI state
  - fake_discount: price raised ~20% for 2-3 weeks then "dropped" back to
    baseline — the deal math should score this near zero on discount depth
  - lowest_ever_now: stable baseline, then a genuine drop below all prior
    history that's still in effect today — lights up is_lowest_ever
  - general: a probabilistic mix of flat/drift/temporary-sale patterns

Stats are computed via the real `app.tasks._recompute_stats` path, so
seeding doubles as an integration check of the deal-math module against
realistic data.

Idempotent by url_hash. Run inside the backend container:

    docker compose exec backend python -m scripts.seed_products
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db import SyncSessionLocal
from app.models import PricePoint, Product
from app.tasks import _recompute_stats
from app.urlnorm import domain_of, normalize_url, url_hash

TOTAL_HISTORY_DAYS = 180

# (slug, title, category, base_price_usd)
CATALOG: list[tuple[str, str, str, int]] = [
    # Electronics
    ("wireless-earbuds-pro", "Wireless Earbuds Pro", "electronics", 179),
    ("noise-cancelling-headphones-xm5", "Noise-Cancelling Headphones XM5", "electronics", 399),
    ("4k-action-camera", "4K Action Camera", "electronics", 329),
    ("portable-bluetooth-speaker", "Portable Bluetooth Speaker", "electronics", 89),
    ("smart-watch-series-9", "Smart Watch Series 9", "electronics", 429),
    ("mechanical-keyboard-rgb", "Mechanical Keyboard RGB", "electronics", 129),
    ("27in-4k-monitor", '27" 4K Monitor', "electronics", 449),
    ("wireless-charging-pad", "Wireless Charging Pad", "electronics", 39),
    ("portable-ssd-1tb", "Portable SSD 1TB", "electronics", 109),
    ("usb-c-hub-8in1", "USB-C Hub 8-in-1", "electronics", 59),
    ("gaming-mouse-wireless", "Wireless Gaming Mouse", "electronics", 79),
    ("webcam-1080p", "Webcam 1080p", "electronics", 69),
    ("tablet-10-9in", 'Tablet 10.9"', "electronics", 549),
    ("e-reader-paperwhite", "E-Reader Paperwhite", "electronics", 139),
    ("smart-home-speaker", "Smart Home Speaker", "electronics", 99),
    ("robot-vacuum", "Robot Vacuum", "electronics", 349),
    ("power-bank-20000mah", "Portable Power Bank 20000mAh", "electronics", 49),
    ("wireless-router-ax6000", "Wireless Router AX6000", "electronics", 229),
    ("fitness-tracker-band", "Fitness Tracker Band", "electronics", 79),
    ("bluetooth-turntable", "Bluetooth Turntable", "electronics", 199),
    ("instant-film-camera", "Instant Film Camera", "electronics", 89),
    ("drone-with-camera", "Drone with Camera", "electronics", 499),
    ("vr-headset", "VR Headset", "electronics", 399),
    ("smart-doorbell-camera", "Smart Doorbell Camera", "electronics", 179),
    ("streaming-media-player-4k", "Streaming Media Player 4K", "electronics", 49),
    # Kitchen
    ("stand-mixer-5-5qt", "Stand Mixer 5.5qt", "kitchen", 379),
    ("air-fryer-6qt", "Air Fryer 6qt", "kitchen", 129),
    ("espresso-machine", "Espresso Machine", "kitchen", 449),
    ("french-press-34oz", "French Press 34oz", "kitchen", 39),
    ("nonstick-cookware-set-10pc", "Non-Stick Cookware Set 10pc", "kitchen", 199),
    ("chefs-knife-8in", 'Chef\'s Knife 8"', "kitchen", 89),
    ("instant-pot-duo-6qt", "Instant Pot Duo 6qt", "kitchen", 99),
    ("blender-high-speed", "High-Speed Blender", "kitchen", 349),
    ("toaster-oven-convection", "Toaster Oven Convection", "kitchen", 159),
    ("electric-kettle-gooseneck", "Electric Gooseneck Kettle", "kitchen", 59),
    ("cast-iron-skillet-12in", 'Cast Iron Skillet 12"', "kitchen", 49),
    ("coffee-grinder-burr", "Burr Coffee Grinder", "kitchen", 79),
    ("sous-vide-precision-cooker", "Sous Vide Precision Cooker", "kitchen", 129),
    ("food-processor-12cup", "Food Processor 12-cup", "kitchen", 179),
    ("waffle-maker-belgian", "Belgian Waffle Maker", "kitchen", 39),
    ("rice-cooker-8cup", "Rice Cooker 8-cup", "kitchen", 69),
    ("knife-block-set-15pc", "Knife Block Set 15pc", "kitchen", 149),
    ("pasta-attachment", "Stand Mixer Pasta Attachment", "kitchen", 89),
    ("digital-kitchen-scale", "Digital Kitchen Scale", "kitchen", 25),
    ("dutch-oven-enameled-7qt", "Enameled Dutch Oven 7qt", "kitchen", 199),
    ("immersion-blender", "Immersion Blender", "kitchen", 49),
    ("electric-wine-opener", "Electric Wine Opener", "kitchen", 29),
    ("vacuum-sealer-system", "Vacuum Sealer System", "kitchen", 119),
    ("countertop-ice-maker", "Countertop Ice Maker", "kitchen", 149),
    ("milk-frother-electric", "Electric Milk Frother", "kitchen", 29),
    # Gaming
    ("wireless-gaming-controller", "Wireless Gaming Controller", "gaming", 69),
    ("gaming-headset-7-1", "Gaming Headset 7.1 Surround", "gaming", 99),
    ("mechanical-gaming-keyboard", "Mechanical Gaming Keyboard", "gaming", 149),
    ("gaming-chair-ergonomic", "Ergonomic Gaming Chair", "gaming", 299),
    ("27in-165hz-gaming-monitor", '27" 165Hz Gaming Monitor', "gaming", 329),
    ("gaming-mouse-pad-xl", "XL Gaming Mouse Pad", "gaming", 29),
    ("capture-card-4k60", "Capture Card 4K60", "gaming", 189),
    ("switch-oled", "Handheld Console OLED", "gaming", 349),
    ("dualsense-controller", "Wireless Controller", "gaming", 69),
    ("gaming-headset-wireless", "Wireless Gaming Headset", "gaming", 149),
    ("rgb-gaming-keyboard-fullsize", "RGB Gaming Keyboard Full-Size", "gaming", 89),
    ("racing-wheel-pedals", "Racing Wheel + Pedals", "gaming", 299),
    ("gaming-router-low-latency", "Low-Latency Gaming Router", "gaming", 249),
    ("portable-gaming-handheld", "Portable Gaming Handheld", "gaming", 199),
    ("vr-gaming-headset", "VR Gaming Headset", "gaming", 429),
    ("gaming-laptop-cooling-pad", "Gaming Laptop Cooling Pad", "gaming", 39),
    ("console-storage-ssd-2tb", "Console Storage Expansion SSD 2TB", "gaming", 169),
    ("gaming-desk-rgb-led", "Gaming Desk with RGB LED", "gaming", 249),
    ("arcade-fight-stick", "Arcade Fight Stick", "gaming", 149),
    ("gaming-microphone-usb", "USB Gaming Microphone", "gaming", 99),
    ("streaming-ring-light-kit", "Streaming Ring Light Kit", "gaming", 59),
    ("retro-console-emulator-box", "Retro Console Emulator Box", "gaming", 79),
    ("gaming-backpack", "Gaming Backpack", "gaming", 69),
    ("controller-charging-dock", "Controller Charging Dock", "gaming", 25),
    ("gaming-monitor-arm-mount", "Gaming Monitor Arm Mount", "gaming", 49),
    # Home
    ("robot-lawn-mower", "Robot Lawn Mower", "home", 999),
    ("smart-thermostat", "Smart Thermostat", "home", 229),
    ("weighted-blanket-15lb", "Weighted Blanket 15lb", "home", 69),
    ("air-purifier-hepa", "HEPA Air Purifier", "home", 179),
    ("cordless-stick-vacuum", "Cordless Stick Vacuum", "home", 299),
    ("memory-foam-topper-queen", "Memory Foam Mattress Topper Queen", "home", 129),
    ("blackout-curtains-set", "Blackout Curtains Set", "home", 49),
    ("led-desk-lamp-dimmable", "Dimmable LED Desk Lamp", "home", 39),
    ("smart-plug-4pack", "Smart Plug 4-Pack", "home", 29),
    ("essential-oil-diffuser", "Essential Oil Diffuser", "home", 35),
    ("standing-desk-converter", "Standing Desk Converter", "home", 199),
    ("office-chair-ergonomic-mesh", "Ergonomic Mesh Office Chair", "home", 259),
    ("space-heater-ceramic", "Ceramic Space Heater", "home", 49),
    ("humidifier-cool-mist", "Cool Mist Humidifier", "home", 59),
    ("smart-video-doorbell", "Smart Video Doorbell", "home", 199),
    ("window-ac-8000btu", "Window AC Unit 8000BTU", "home", 329),
    ("bathroom-scale-smart", "Smart Bathroom Scale", "home", 39),
    ("shower-head-filtered", "Filtered Shower Head", "home", 45),
    ("bedside-smart-lamp", "Bedside Smart Lamp", "home", 49),
    ("closet-organizer-system", "Closet Organizer System", "home", 149),
    ("area-rug-5x7", "Area Rug 5x7", "home", 129),
    ("memory-foam-pillow-2pack", "Memory Foam Pillow 2-Pack", "home", 59),
    ("security-camera-system-4cam", "Security Camera System 4-Cam", "home", 249),
    ("garden-tool-set-10pc", "Garden Tool Set 10pc", "home", 89),
    ("cordless-drill-kit", "Cordless Drill Kit", "home", 99),
]

# Index ranges within CATALOG assigning each seed pattern.
SHORT_HISTORY_RANGE = range(0, 5)
FAKE_DISCOUNT_RANGE = range(5, 20)
LOWEST_EVER_RANGE = range(20, 30)


def _q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _jitter(rng: random.Random, price: Decimal, pct: float = 0.01) -> Decimal:
    delta = price * Decimal(str(rng.uniform(-pct, pct)))
    return _q(price + delta)


def generate_short_history(rng: random.Random, base_price: Decimal) -> list[tuple[int, Decimal]]:
    """<14 days of coverage — exercises the 'score unlocks after 2 weeks'
    insufficient-history UI state."""
    days = rng.randint(6, 12)
    return [(d, _jitter(rng, base_price)) for d in range(days, -1, -1)]


def generate_fake_discount(rng: random.Random, base_price: Decimal) -> list[tuple[int, Decimal]]:
    """Raise the price ~20% for 2-3 weeks, then 'drop' back to baseline.
    The deal math should score this near zero on discount depth, since the
    90-day median never actually moved."""
    raise_days = rng.randint(14, 21)
    drop_days = rng.randint(2, 5)
    baseline_days = TOTAL_HISTORY_DAYS - raise_days - drop_days

    points: list[tuple[int, Decimal]] = []
    day = TOTAL_HISTORY_DAYS - 1
    for _ in range(baseline_days):
        points.append((day, _jitter(rng, base_price)))
        day -= 1
    raised = base_price * Decimal("1.20")
    for _ in range(raise_days):
        points.append((day, _jitter(rng, raised)))
        day -= 1
    for _ in range(drop_days):
        points.append((day, _jitter(rng, base_price)))
        day -= 1
    return points


def generate_lowest_ever_now(rng: random.Random, base_price: Decimal) -> list[tuple[int, Decimal]]:
    """Stable baseline, then a genuine trailing drop below all prior
    history, still in effect today — lights up is_lowest_ever and puts the
    product near the top of the deals feed."""
    drop_days = rng.randint(3, 7)
    baseline_days = TOTAL_HISTORY_DAYS - drop_days

    points: list[tuple[int, Decimal]] = []
    day = TOTAL_HISTORY_DAYS - 1
    for _ in range(baseline_days):
        points.append((day, _jitter(rng, base_price)))
        day -= 1

    new_low = base_price * Decimal(str(rng.uniform(0.55, 0.75)))
    drop_points: list[tuple[int, Decimal]] = []
    for _ in range(drop_days):
        drop_points.append((day, _jitter(rng, new_low)))
        day -= 1

    # is_lowest_ever requires the LATEST price (today, day 0 — the last
    # entry here) to be at or below every prior price, including the rest
    # of this same drop window. Independent per-day jitter could otherwise
    # leave an earlier day in the window slightly lower than today, which
    # would silently defeat the whole point of this seed pattern.
    min_in_drop = min(price for _, price in drop_points)
    last_day, last_price = drop_points[-1]
    drop_points[-1] = (last_day, min(min_in_drop, last_price))

    points.extend(drop_points)
    return points


def generate_general(rng: random.Random, base_price: Decimal) -> list[tuple[int, Decimal]]:
    """Probabilistic mix of a long flat baseline, slow drift, or a couple
    of temporary genuine sales — the bulk of the catalog."""
    pattern = rng.choice(["flat", "drift", "sale"])
    points: list[tuple[int, Decimal]] = []
    price = base_price
    in_sale = False
    sale_days_left = 0
    sale_price = base_price

    for day in range(TOTAL_HISTORY_DAYS - 1, -1, -1):
        if pattern == "drift":
            price = _q(price * Decimal(str(1 + rng.uniform(-0.003, 0.003))))
            points.append((day, price))
            continue

        if pattern == "sale":
            if not in_sale and day > 5 and rng.random() < 0.012:
                in_sale = True
                sale_days_left = rng.randint(3, 10)
                sale_price = _q(base_price * Decimal(str(rng.uniform(0.70, 0.92))))
            if in_sale:
                points.append((day, _jitter(rng, sale_price)))
                sale_days_left -= 1
                if sale_days_left <= 0:
                    in_sale = False
            else:
                points.append((day, _jitter(rng, base_price)))
            continue

        points.append((day, _jitter(rng, base_price)))  # flat

    return points


def _image_url(category: str, slug: str, lock: int) -> str:
    keyword = f"{category},{slug}".lower().replace(" ", "").replace("-", "")
    return f"https://loremflickr.com/640/480/{keyword}?lock={lock}"


def run() -> None:
    inserted = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    with SyncSessionLocal() as session:
        for i, (slug, title, category, base_price_usd) in enumerate(CATALOG):
            url = f"https://shop.wasitcheaper.example/p/{slug}"
            normalized = normalize_url(url)
            hashed = url_hash(normalized)

            exists = session.execute(
                select(Product.id).where(Product.url_hash == hashed)
            ).scalar_one_or_none()
            if exists:
                skipped += 1
                continue

            rng = random.Random(f"wasitcheaper-seed-{slug}")
            base_price = Decimal(str(base_price_usd))

            if i in SHORT_HISTORY_RANGE:
                raw_points = generate_short_history(rng, base_price)
            elif i in FAKE_DISCOUNT_RANGE:
                raw_points = generate_fake_discount(rng, base_price)
            elif i in LOWEST_EVER_RANGE:
                raw_points = generate_lowest_ever_now(rng, base_price)
            else:
                raw_points = generate_general(rng, base_price)

            product = Product(
                url=normalized,
                url_hash=hashed,
                domain=domain_of(normalized),
                title=title,
                image_url=_image_url(category, slug, i),
                currency="USD",
                extraction_strategy="json_ld",
                extraction_meta={"seed": True, "category": category},
                status="demo",
                consecutive_failures=0,
                last_checked_at=now,
                created_at=now - timedelta(days=len(raw_points)),
            )
            session.add(product)
            session.flush()

            for days_ago, price in raw_points:
                session.add(
                    PricePoint(
                        product_id=product.id,
                        price=price,
                        currency="USD",
                        in_stock=True,
                        captured_at=now - timedelta(days=days_ago),
                        source="seed",
                    )
                )
            session.flush()

            _recompute_stats(session, product)
            inserted += 1

        session.commit()

    print(f"seed done: inserted={inserted} skipped={skipped}")


if __name__ == "__main__":
    run()
