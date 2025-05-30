import React from 'react';

function Cart({ cart }) {
  const items = Object.values(cart || {});
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  if (!items.length) return <div>Корзина пуста</div>;

  return (
    <div>
      <h2>Корзина</h2>
      <ul>
        {items.map(item => (
          <li key={item.product.id}>
            {item.product.name} x{item.quantity} — {item.product.price * item.quantity}₽
          </li>
        ))}
      </ul>
      <b>Итого: {total}₽</b>
    </div>
  );
}

export default Cart;