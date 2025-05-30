import React, { useState, useEffect } from 'react';
import ProductList from './ProductList';
import Cart from './Cart';
import Checkout from './Checkout';

function App() {
  const [userId] = useState('test_user'); // для теста, можно заменить на Telegram id
  const [cart, setCart] = useState({});
  const [step, setStep] = useState('products');

  // Получить корзину при старте
  useEffect(() => {
    fetch(`http://localhost:3001/api/cart?user_id=${userId}`)
      .then(res => res.json())
      .then(setCart);
  }, [userId]);

  const handleAddToCart = (productId) => {
    fetch('http://localhost:3001/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, product_id: productId })
    })
      .then(res => res.json())
      .then(setCart);
  };

  return (
    <div>
      <h1>Магазин</h1>
      {step === 'products' && (
        <>
          <ProductList onAdd={handleAddToCart} />
          <button onClick={() => setStep('cart')}>Корзина</button>
        </>
      )}
      {step === 'cart' && (
        <>
          <Cart cart={cart} />
          <button onClick={() => setStep('products')}>Назад</button>
          <button onClick={() => setStep('checkout')}>Оформить заказ</button>
        </>
      )}
      {step === 'checkout' && (
        <Checkout userId={userId} cart={cart} onBack={() => setStep('cart')} />
      )}
    </div>
  );
}

export default App;