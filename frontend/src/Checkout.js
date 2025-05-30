import React, { useState } from 'react';

function Checkout({ userId, cart, onBack }) {
  const [form, setForm] = useState({
    name: '', surname: '', phone: '', address: ''
  });
  const [status, setStatus] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = e => {
    e.preventDefault();
    fetch('http://localhost:3001/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, ...form })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setStatus('Заказ оформлен!');
        else setStatus(data.error || 'Ошибка');
      });
  };

  return (
    <div>
      <h2>Оформление заказа</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Имя" value={form.name} onChange={handleChange} required /><br />
        <input name="surname" placeholder="Фамилия" value={form.surname} onChange={handleChange} required /><br />
        <input name="phone" placeholder="Телефон" value={form.phone} onChange={handleChange} required /><br />
        <input name="address" placeholder="Адрес" value={form.address} onChange={handleChange} required /><br />
        <button type="submit">Подтвердить</button>
      </form>
      <button onClick={onBack}>Назад</button>
      <div>{status}</div>
    </div>
  );
}

export default Checkout;