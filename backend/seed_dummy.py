import os
import sys
import random
from datetime import datetime, timedelta

# Tambahkan backend/ ke sys.path agar bisa import app module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import selectinload
from app.database import SessionLocal, engine, Base
from app.models import Category, Product, ModifierGroup, Modifier, ProductModifierGroup, User, Shift, Order, OrderItem, OrderItemModifier
from app.seed import seed_admin

def seed_dummy_data():
    # Recreate all tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("🚀 Mulai menambahkan data dummy KopiPOS dengan skema baru...")
        
        # 0. Pastikan user admin/kasir tersedia
        seed_admin()
        
        # 1. Tambah / Update Kategori (dengan sort_order)
        categories_data = [
            {"name": "Signature Coffee", "sort_order": 1},
            {"name": "Espresso Based", "sort_order": 2},
            {"name": "Manual Brew", "sort_order": 3},
            {"name": "Milk & Tea Series", "sort_order": 4},
            {"name": "Refreshers & Mocktail", "sort_order": 5},
            {"name": "Pastry & Bakery", "sort_order": 6},
            {"name": "Savory Bites", "sort_order": 7},
            {"name": "Sweet Desserts", "sort_order": 8}
        ]
        
        category_map = {}
        for cat_data in categories_data:
            cat_name = cat_data["name"]
            cat = db.query(Category).filter(Category.name == cat_name).first()
            if not cat:
                cat = Category(name=cat_name, sort_order=cat_data["sort_order"], is_active=True)
                db.add(cat)
                db.flush()
            else:
                cat.sort_order = cat_data["sort_order"]
                cat.is_active = True
            category_map[cat_name] = cat.id

        # 2. Tambah Modifier Groups & Modifiers
        modifier_groups_config = {
            "Size": {
                "selection_type": "radio", "required": True, "min_select": 1, "max_select": 1, "sort_order": 1,
                "options": [
                    {"name": "Regular", "price": 0, "sort_order": 1},
                    {"name": "Large", "price": 5000, "sort_order": 2}
                ]
            },
            "Sugar": {
                "selection_type": "radio", "required": True, "min_select": 1, "max_select": 1, "sort_order": 2,
                "options": [
                    {"name": "Normal Sugar", "price": 0, "sort_order": 1},
                    {"name": "Less Sugar", "price": 0, "sort_order": 2},
                    {"name": "No Sugar", "price": 0, "sort_order": 3}
                ]
            },
            "Ice": {
                "selection_type": "radio", "required": False, "min_select": 0, "max_select": 1, "sort_order": 3,
                "options": [
                    {"name": "Normal Ice", "price": 0, "sort_order": 1},
                    {"name": "Less Ice", "price": 0, "sort_order": 2},
                    {"name": "No Ice", "price": 0, "sort_order": 3}
                ]
            },
            "Milk": {
                "selection_type": "checkbox", "required": False, "min_select": 0, "max_select": 1, "sort_order": 4,
                "options": [
                    {"name": "Oat Milk", "price": 8000, "sort_order": 1},
                    {"name": "Almond Milk", "price": 8000, "sort_order": 2}
                ]
            },
            "Topping": {
                "selection_type": "checkbox", "required": False, "min_select": 0, "max_select": 3, "sort_order": 5,
                "options": [
                    {"name": "Boba Pearls", "price": 5000, "sort_order": 1},
                    {"name": "Cheese Foam", "price": 7000, "sort_order": 2},
                    {"name": "Vanilla Ice Cream", "price": 8000, "sort_order": 3}
                ]
            }
        }

        group_map = {}
        modifier_map = {} # name -> modifier object
        
        for group_name, config in modifier_groups_config.items():
            group = db.query(ModifierGroup).filter(ModifierGroup.name == group_name).first()
            if not group:
                group = ModifierGroup(
                    name=group_name,
                    selection_type=config["selection_type"],
                    required=config["required"],
                    min_select=config["min_select"],
                    max_select=config["max_select"],
                    sort_order=config["sort_order"],
                    status="active"
                )
                db.add(group)
                db.flush()
            else:
                group.selection_type = config["selection_type"]
                group.required = config["required"]
                group.min_select = config["min_select"]
                group.max_select = config["max_select"]
                group.sort_order = config["sort_order"]
                group.status = "active"
            
            group_map[group_name] = group
            
            # Seed options for this group
            for opt in config["options"]:
                mod = db.query(Modifier).filter(Modifier.modifier_group_id == group.id, Modifier.name == opt["name"]).first()
                if not mod:
                    mod = Modifier(
                        modifier_group_id=group.id,
                        name=opt["name"],
                        price_adjustment=opt["price"],
                        sort_order=opt["sort_order"],
                        status="active",
                        is_out_of_stock=False
                    )
                    db.add(mod)
                else:
                    mod.price_adjustment = opt["price"]
                    mod.sort_order = opt["sort_order"]
                    mod.status = "active"
                db.flush()
                modifier_map[opt["name"]] = mod

        db.commit()

        # 3. Tambah 30 Menu / Produk (dengan sort_order & relasi ke modifier groups)
        products_data = [
            # Signature Coffee (5 items)
            {
                "name": "Es Kopi Susu Aren Spesial", "category": "Signature Coffee", "price": 22000,
                "desc": "Kopi espresso dengan susu segar creamy dan gula aren organik pilihan",
                "image_url": "/uploads/kopi_susu_aren.png", "sort_order": 1,
                "groups": ["Size", "Sugar", "Ice", "Milk", "Topping"]
            },
            {
                "name": "Salted Caramel Macchiato", "category": "Signature Coffee", "price": 28000,
                "desc": "Espresso berlapis susu dengan saus karamel manis gurih bertabur sea salt",
                "image_url": "https://images.unsplash.com/photo-1599398054066-846f28917f38?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": ["Size", "Sugar", "Ice", "Milk"]
            },
            {
                "name": "Avocado Coffee Float", "category": "Signature Coffee", "price": 32000,
                "desc": "Jus alpukat mentega dipadukan dengan satu shot espresso dan es krim vanila",
                "image_url": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": ["Size", "Sugar", "Ice"]
            },
            {
                "name": "Pandanta Coffee Latte", "category": "Signature Coffee", "price": 26000,
                "desc": "Sensasi kopi susu dengan ekstrak daun pandan asli yang harum alami",
                "image_url": "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=600&auto=format&fit=crop&q=80", "sort_order": 4,
                "groups": ["Size", "Sugar", "Ice", "Milk", "Topping"]
            },
            {
                "name": "Kopi Butter Creamy", "category": "Signature Coffee", "price": 25000,
                "desc": "Kopi hitam khas dipadukan dengan butter asin menghasilkan rasa gurih legit",
                "image_url": "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80", "sort_order": 5,
                "groups": ["Size", "Sugar", "Ice"]
            },
            # Espresso Based (5 items)
            {
                "name": "Espresso Double Shot", "category": "Espresso Based", "price": 15000,
                "desc": "Ekstraksi kopi murni bertekanan tinggi dari biji kopi arabika pilihan",
                "image_url": "https://images.unsplash.com/photo-1510707577719-ee7c282ac1a1?w=600&auto=format&fit=crop&q=80", "sort_order": 1,
                "groups": []
            },
            {
                "name": "Caffe Americano", "category": "Espresso Based", "price": 18000,
                "desc": "Espresso ganda yang dilarutkan dengan air panas, citarasa bersih dan intens",
                "image_url": "https://images.unsplash.com/photo-1551046713-b45a4b6d6818?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": ["Size", "Sugar", "Ice"]
            },
            {
                "name": "Cappuccino Classic", "category": "Espresso Based", "price": 24000,
                "desc": "Keseimbangan sempurna espresso, susu panas, dan busa susu tebal di atasnya",
                "image_url": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": ["Size", "Sugar", "Ice", "Milk"]
            },
            {
                "name": "Cafe Latte Art", "category": "Espresso Based", "price": 24000,
                "desc": "Espresso lembut berpadu dengan steamed milk berhias seni latte cantik",
                "image_url": "https://images.unsplash.com/photo-1570968915860-54d5c301fc9f?w=600&auto=format&fit=crop&q=80", "sort_order": 4,
                "groups": ["Size", "Sugar", "Ice", "Milk", "Topping"]
            },
            {
                "name": "Mocha Latte Temptation", "category": "Espresso Based", "price": 27000,
                "desc": "Paduan espresso, saus cokelat hitam pekat, susu segar, dan foam tipis",
                "image_url": "https://images.unsplash.com/photo-1607681034540-2c46cc71896d?w=600&auto=format&fit=crop&q=80", "sort_order": 5,
                "groups": ["Size", "Sugar", "Ice", "Milk", "Topping"]
            },
            # Manual Brew (3 items)
            {
                "name": "V60 Flores Bajawa", "category": "Manual Brew", "price": 24000,
                "desc": "Metode pour-over menghasilkan rasa kopi yang jernih dengan aroma cokelat-karamel",
                "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&auto=format&fit=crop&q=80", "sort_order": 1,
                "groups": ["Ice"]
            },
            {
                "name": "Japanese Iced Dripper", "category": "Manual Brew", "price": 26000,
                "desc": "Manual brew yang diteteskan langsung di atas es batu, menyegarkan dengan notes buah",
                "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": ["Sugar"]
            },
            {
                "name": "Vietnam Drip Susu", "category": "Manual Brew", "price": 20000,
                "desc": "Kopi robusta kental yang menetes lambat ke dalam cangkir berisi susu kental manis",
                "image_url": "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": ["Ice"]
            },
            # Milk & Tea Series (4 items)
            {
                "name": "Matcha Latte Premium", "category": "Milk & Tea Series", "price": 25000,
                "desc": "Bubuk teh hijau matcha Jepang asli diseduh susu segar creamy yang menenangkan",
                "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80", "sort_order": 1,
                "groups": ["Size", "Sugar", "Ice", "Milk", "Topping"]
            },
            {
                "name": "Earl Grey Milk Tea", "category": "Milk & Tea Series", "price": 23000,
                "desc": "Teh hitam Earl Grey beraroma bergamot harum diseduh susu dan krimer lezat",
                "image_url": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": ["Size", "Sugar", "Ice", "Topping"]
            },
            {
                "name": "Thai Tea Original Ice", "category": "Milk & Tea Series", "price": 20000,
                "desc": "Teh Thai racikan otentik berwarna oranye cantik berpadu susu evaporasi gurih",
                "image_url": "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": ["Size", "Sugar", "Ice", "Topping"]
            },
            {
                "name": "Chocolate Hazelnut Milk", "category": "Milk & Tea Series", "price": 24000,
                "desc": "Minuman susu cokelat pekat dipadu sirup hazelnut wangi kacang panggang",
                "image_url": "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&auto=format&fit=crop&q=80", "sort_order": 4,
                "groups": ["Size", "Sugar", "Ice", "Topping"]
            },
            # Refreshers & Mocktail (3 items)
            {
                "name": "Lychee Yakult Lemonade", "category": "Refreshers & Mocktail", "price": 22000,
                "desc": "Kombinasi probiotik Yakult, sirup leci manis, soda, buah leci utuh, dan jeruk lemon",
                "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80", "sort_order": 1,
                "groups": ["Sugar", "Ice", "Topping"]
            },
            {
                "name": "Virgin Mojito Mint", "category": "Refreshers & Mocktail", "price": 20000,
                "desc": "Minuman mocktail segar berisi remasan daun mint, jeruk nipis asli, gula, dan soda",
                "image_url": "https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": ["Sugar", "Ice"]
            },
            {
                "name": "Sunset Orange Sparkler", "category": "Refreshers & Mocktail", "price": 23000,
                "desc": "Gradasi sirup grenadine merah, jus jeruk segar manis, soda, dan potongan buah jeruk",
                "image_url": "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": ["Sugar", "Ice"]
            },
            # Pastry & Bakery (4 items)
            {
                "name": "Butter Croissant Crispy", "category": "Pastry & Bakery", "price": 18000,
                "desc": "Pastri mentega berlapis ala Prancis yang garing di luar, lembut berserat di dalam",
                "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80", "sort_order": 1,
                "groups": []
            },
            {
                "name": "Pain au Chocolat Fudge", "category": "Pastry & Bakery", "price": 22000,
                "desc": "Croissant berbentuk gulung isi batang cokelat hitam yang lumer saat dipanaskan",
                "image_url": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": []
            },
            {
                "name": "Cinnamon Roll Glazed", "category": "Pastry & Bakery", "price": 20000,
                "desc": "Roti gulung kayu manis lembut berselimut siraman gula cair (sugar glaze) melimpah",
                "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": []
            },
            {
                "name": "Almond Croissant Toast", "category": "Pastry & Bakery", "price": 25000,
                "desc": "Croissant mentega dengan isian krim almond gurih bertabur irisan almond renyah",
                "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80", "sort_order": 4,
                "groups": []
            },
            # Savory Bites (3 items)
            {
                "name": "French Fries Truffle Oil", "category": "Savory Bites", "price": 18000,
                "desc": "Kentang goreng renyah bumbu bawang bertabur minyak truffle wangi mewah dan parsley",
                "image_url": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80", "sort_order": 1,
                "groups": []
            },
            {
                "name": "Crispy Chicken Wings (5pcs)", "category": "Savory Bites", "price": 28000,
                "desc": "Sayap ayam goreng renyah berbalur saus BBQ manis gurih pedas sedang",
                "image_url": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": []
            },
            {
                "name": "Tuna Mayo Croissant Sandwich", "category": "Savory Bites", "price": 32000,
                "desc": "Croissant besar isi daging tuna hancur berbumbu mayones, selada segar, dan keju slice",
                "image_url": "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": []
            },
            # Sweet Desserts (3 items)
            {
                "name": "Classic Tiramisu Cup", "category": "Sweet Desserts", "price": 26000,
                "desc": "Kue lapis biskuit ladyfinger terendam espresso dipadu keju mascarpone legit",
                "image_url": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80", "sort_order": 1,
                "groups": []
            },
            {
                "name": "Double Chocolate Brownie Slice", "category": "Sweet Desserts", "price": 20000,
                "desc": "Brownies cokelat panggang fudgy padat dengan taburan chocochip melimpah",
                "image_url": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80", "sort_order": 2,
                "groups": ["Topping"]
            },
            {
                "name": "Cheesecake Strawberry Coulis", "category": "Sweet Desserts", "price": 28000,
                "desc": "Kue keju panggang super lembut berlapis saus stroberi asam manis segar di atasnya",
                "image_url": "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80", "sort_order": 3,
                "groups": []
            }
        ]

        for prod_data in products_data:
            cat_id = category_map[prod_data["category"]]
            prod = db.query(Product).filter(Product.name == prod_data["name"]).first()
            if not prod:
                prod = Product(
                    category_id=cat_id,
                    name=prod_data["name"],
                    base_price=prod_data["price"],
                    description=prod_data["desc"],
                    image_url=prod_data.get("image_url"),
                    sort_order=prod_data["sort_order"],
                    is_active=True
                )
                db.add(prod)
                db.flush()
            else:
                prod.category_id = cat_id
                prod.base_price = prod_data["price"]
                prod.description = prod_data["desc"]
                prod.image_url = prod_data.get("image_url")
                prod.sort_order = prod_data["sort_order"]
                prod.is_active = True
                db.flush()

            # Bersihkan relasi produk modifier group lama
            db.query(ProductModifierGroup).filter(ProductModifierGroup.product_id == prod.id).delete()
            
            # Hubungkan modifier group baru
            for idx, group_name in enumerate(prod_data["groups"]):
                if group_name in group_map:
                    group_id = group_map[group_name].id
                    db.add(ProductModifierGroup(
                        product_id=prod.id,
                        modifier_group_id=group_id,
                        sort_order=idx
                    ))

        db.commit()
        print("✅ Berhasil menyimpan 30 menu dan relasi Modifier Group.")

        # 4. Buat 50 Transaksi Dummy pada Tanggal 27 Juni 2026
        target_date_str = "20260627"
        existing_orders = db.query(Order).filter(Order.order_number.like(f"KP-{target_date_str}-%")).count()
        
        if existing_orders < 50:
            print(f"📦 Membuat transaksi dummy untuk tanggal 27 Juni 2026 (eksisting: {existing_orders}, target: 50)...")
            
            cashier = db.query(User).filter(User.email == "kasir@kopipos.com").first()
            if not cashier:
                cashier = db.query(User).first()
                
            # Buat shift dummy untuk 27 Juni 2026 jika belum ada
            shift_start = datetime(2026, 6, 27, 7, 30, 0)
            shift_end = datetime(2026, 6, 27, 22, 30, 0)
            shift = db.query(Shift).filter(
                Shift.started_at >= datetime(2026, 6, 27, 0, 0, 0),
                Shift.started_at <= datetime(2026, 6, 27, 23, 59, 59)
            ).first()
            
            if not shift and cashier:
                shift = Shift(
                    cashier_id=cashier.id,
                    opening_balance=500000.0,
                    status="closed",
                    started_at=shift_start,
                    ended_at=shift_end
                )
                db.add(shift)
                db.flush()
                
            all_prods = db.query(Product).options(selectinload(Product.product_modifier_groups).selectinload(ProductModifierGroup.modifier_group).selectinload(ModifierGroup.modifiers)).filter(Product.is_active == True).all()
            
            customer_names = [
                "Budi Santoso", "Siti Aminah", "Reza Rahardian", "Dinda Hauw", "Agus Pratama",
                "Maya Septha", "Fajar Nugraha", "Rina Nose", "Dimas Anggara", "Anisa Rahma",
                "Dewi Persik", "Hendra Setiawan", "Kevin Sanjaya", "Greysia Polii", "Taufik Hidayat",
                "Putri Tanjung", "Rafi Ahmad", "Nagita Slavina", "Deddy Corbuzier", "Mandy Moore"
            ]
            payment_methods = ["cash", "qris", "transfer"]
            order_types = ["dine_in", "takeaway"]
            
            total_shift_sales = 0.0
            for i in range(existing_orders + 1, 51):
                order_num = f"KP-{target_date_str}-{i:03d}"
                
                rand_hour = random.randint(8, 21)
                rand_min = random.randint(0, 59)
                rand_sec = random.randint(0, 59)
                order_time = datetime(2026, 6, 27, rand_hour, rand_min, rand_sec)
                
                num_items = random.randint(1, 3)
                selected_prods = random.sample(all_prods, min(num_items, len(all_prods)))
                
                order_items_obj = []
                subtotal = 0.0
                
                for prod in selected_prods:
                    qty = random.randint(1, 3)
                    unit_price = prod.base_price
                    chosen_mods = []
                    
                    # Pilih modifier random berdasarkan modifier groups terkait
                    for pmg in prod.product_modifier_groups:
                        group = pmg.modifier_group
                        # skip if group inactive
                        if group.status != "active":
                            continue
                        
                        group_mods = group.modifiers
                        if not group_mods:
                            continue
                        
                        # Jika radio dan required, pilih 1
                        if group.selection_type == "radio":
                            if group.required or random.random() > 0.3:
                                chosen_mods.append(random.choice(group_mods))
                        # Jika checkbox
                        elif group.selection_type == "checkbox":
                            if group.required:
                                # pilih minimal min_select
                                select_count = random.randint(group.min_select, group.max_select)
                                if select_count > 0:
                                    chosen_mods.extend(random.sample(group_mods, select_count))
                            else:
                                if random.random() > 0.5:
                                    select_count = random.randint(1, group.max_select)
                                    chosen_mods.extend(random.sample(group_mods, select_count))

                    # Calculate unit price containing chosen modifiers
                    unit_price += sum(m.price_adjustment for m in chosen_mods)
                    item_subtotal = unit_price * qty
                    subtotal += item_subtotal
                    
                    mod_names_str = ", ".join(m.name for m in chosen_mods) if chosen_mods else None
                    
                    oi = OrderItem(
                        product_id=prod.id,
                        product_name=prod.name,
                        base_price=prod.base_price,
                        quantity=qty,
                        unit_price=unit_price,
                        variant_name=None, # Deprecated
                        modifier_names=mod_names_str, # Legacy string compatibility
                        subtotal=item_subtotal
                    )
                    
                    # Simpan OrderItemModifier snapshots
                    for m in chosen_mods:
                        oi.modifiers.append(OrderItemModifier(
                            modifier_group_name=m.modifier_group.name,
                            modifier_name=m.name,
                            price_adjustment=m.price_adjustment
                        ))
                        
                    order_items_obj.append(oi)
                    
                discount = 0.0
                if random.random() < 0.2 and subtotal > 30000:
                    discount = random.choice([5000.0, 10000.0])
                total = max(subtotal - discount, 0.0)
                total_shift_sales += total
                
                order = Order(
                    order_number=order_num,
                    cashier_id=cashier.id if cashier else None,
                    shift_id=shift.id if shift else None,
                    order_type=random.choice(order_types),
                    payment_method=random.choice(payment_methods),
                    subtotal=subtotal,
                    discount=discount,
                    total=total,
                    status="paid",
                    source="cashier",
                    customer_name=random.choice(customer_names),
                    created_at=order_time
                )
                db.add(order)
                db.flush()
                
                for oi in order_items_obj:
                    oi.order_id = order.id
                    db.add(oi)
                    
            if shift:
                if not shift.closing_expected:
                    shift.closing_expected = shift.opening_balance
                shift.closing_expected += total_shift_sales
                shift.closing_actual = shift.closing_expected
                
            db.commit()
            print("✅ 50 Transaksi dummy berhasil ditambahkan!")
        else:
            print("ℹ️  50 Transaksi dummy sudah ada sebelumnya.")
            
        print("🎉 Semua data dummy KopiPOS siap digunakan!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data dummy: {str(e)}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_dummy_data()
