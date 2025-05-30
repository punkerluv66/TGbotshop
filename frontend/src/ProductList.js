import React, { useEffect, useState } from 'react';

function ProductList({ onAdd }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/products')
      .then(res => res.json())
      .then(setProducts);
  }, []);

  return (
    <div>
      <h2>Товары</h2>
      <ul>
        {products.map(p => (
          <li key={p.id}>
            {p.name} — {p.price}₽ ({p.amount} шт.)
            <button disabled={p.amount < 1} onClick={() => onAdd(p.id)}>
              В корзину
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProductList;