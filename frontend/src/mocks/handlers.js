import { http, HttpResponse } from 'msw'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

// Dummy Data
const categories = [
  { id: 1, name: 'Kopi', slug: 'kopi' },
  { id: 2, name: 'Non-Kopi', slug: 'non-kopi' },
  { id: 3, name: 'Makanan', slug: 'makanan' },
  { id: 4, name: 'Snack', slug: 'snack' },
]

const products = [
  {
    id: 1,
    name: 'Es Kopi Susu Aren',
    category_id: 1,
    base_price: 20000,
    description: 'Kopi espresso dengan susu segar dan gula aren asli',
    image_url: null,
    variants: [
      { id: 1, name: 'Reguler', price_adjustment: 0 },
      { id: 2, name: 'Large', price_adjustment: 5000 }
    ],
    modifiers: []
  },
  {
    id: 2,
    name: 'Americano',
    category_id: 1,
    base_price: 18000,
    description: 'Espresso dengan air',
    image_url: null,
    variants: [
      { id: 3, name: 'Hot', price_adjustment: 0 },
      { id: 4, name: 'Ice', price_adjustment: 2000 }
    ],
    modifiers: []
  },
  {
    id: 3,
    name: 'Matcha Latte',
    category_id: 2,
    base_price: 25000,
    description: 'Matcha premium dengan susu segar',
    image_url: null,
    variants: [
      { id: 5, name: 'Hot', price_adjustment: 0 },
      { id: 6, name: 'Ice', price_adjustment: 3000 }
    ],
    modifiers: []
  },
  {
    id: 4,
    name: 'Croissant Butter',
    category_id: 3,
    base_price: 22000,
    description: 'Croissant mentega yang renyah',
    image_url: null,
    variants: [],
    modifiers: []
  },
  {
    id: 5,
    name: 'French Fries',
    category_id: 4,
    base_price: 18000,
    description: 'Kentang goreng renyah dengan saus',
    image_url: null,
    variants: [],
    modifiers: []
  }
]

export const handlers = [
  // Auth Handlers
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    return HttpResponse.json({
      access_token: 'fake-jwt-token',
      token_type: 'bearer'
    })
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    return HttpResponse.json({
      id: 1,
      email: 'owner@kopipos.com',
      full_name: 'Owner Kopipos',
      role: 'owner',
      is_active: true
    })
  }),

  // Categories Handlers
  http.get(`${API_BASE}/categories`, () => {
    return HttpResponse.json(categories)
  }),

  // Products Handlers
  http.get(`${API_BASE}/products`, () => {
    return HttpResponse.json(products)
  }),

  // Modifiers Handlers
  http.get(`${API_BASE}/modifiers`, () => {
    return HttpResponse.json([
      { id: 1, name: 'Extra Shot Espresso', price_adjustment: 5000 },
      { id: 2, name: 'Oat Milk', price_adjustment: 8000 },
      { id: 3, name: 'Less Sugar', price_adjustment: 0 },
      { id: 4, name: 'Extra Ice', price_adjustment: 0 }
    ])
  }),

  // Orders Handlers
  http.post(`${API_BASE}/orders`, async ({ request }) => {
    const orderData = await request.json()
    return HttpResponse.json({
      id: 101,
      receipt_number: 'REC-12345678',
      status: 'completed',
      total_amount: orderData.total_amount || 0,
      payment_method: orderData.payment_method || 'cash',
      created_at: new Date().toISOString()
    })
  }),
  
  // Settings Handler (for store info)
  http.get(`${API_BASE}/settings`, () => {
    return HttpResponse.json({
      store_name: 'Kopi POS',
      store_address: 'Jl. Jendral Sudirman No. 1, Jakarta',
      store_phone: '081234567890',
      tax_rate: 10,
      receipt_footer: 'Terima kasih atas kunjungan Anda'
    })
  }),
]
