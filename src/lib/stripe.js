import { loadStripe } from '@stripe/stripe-js'

// แทนที่ด้วย Publishable Key ของคุณจาก Dashboard Stripe (ขึ้นต้นด้วย pk_test_ หรือ pk_live_)
let stripePromise
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}