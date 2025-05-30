// filepath: c:\Mirrors\api.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db, cart } = require('./bot');

const api = express();
const API_PORT = process.env.API_PORT || 3001;

api.use(cors());
api.use(bodyParser.json());

// ...existing code...


api.use(cors());
api.use(bodyParser.json());

// Получить список товаров
api.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

// Получить корзину пользователя (user_id — query param)
api.get('/api/cart', (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    res.json(cart[userId] || {});
});

// Добавить товар в корзину
api.post('/api/cart', (req, res) => {
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) return res.status(400).json({ error: 'user_id и product_id обязательны' });

    db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
        if (err || !product) return res.status(404).json({ error: 'Товар не найден' });

        let userCart = cart[user_id] || {};
        if (userCart[product_id]) {
            if (userCart[product_id].quantity < product.amount) {
                userCart[product_id].quantity += 1;
            } else {
                return res.status(400).json({ error: 'Превышено количество на складе' });
            }
        } else {
            if (product.amount > 0) {
                userCart[product_id] = { product, quantity: 1 };
            } else {
                return res.status(400).json({ error: 'Нет в наличии' });
            }
        }
        cart[user_id] = userCart;
        res.json(cart[user_id]);
    });
});

// Оформить заказ
api.post('/api/checkout', (req, res) => {
    const { user_id, name, surname, phone, address } = req.body;
    if (!user_id || !name || !surname || !phone || !address) {
        return res.status(400).json({ error: 'Не все поля заполнены' });
    }

    const userCart = cart[user_id] || {};
    if (Object.keys(userCart).length === 0) return res.status(400).json({ error: 'Корзина пуста' });

    const productIds = Object.keys(userCart);
    const placeholders = productIds.map(() => '?').join(',');
    db.all(`SELECT id, amount FROM products WHERE id IN (${placeholders})`, productIds, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка проверки товаров' });

        const stockMap = {};
        rows.forEach(row => stockMap[row.id] = row.amount);

        let canProceed = true;
        for (const id in userCart) {
            if (stockMap[id] === undefined || stockMap[id] < userCart[id].quantity) {
                canProceed = false;
                break;
            }
        }

        if (canProceed) {
            const items = Object.values(userCart).map(item => ({
                id: item.product.id,
                name: item.product.name,
                price: item.product.price,
                quantity: item.quantity
            }));
            const total = Object.values(userCart).reduce((sum, item) => sum + item.product.price * item.quantity, 0);
            const itemsJSON = JSON.stringify(items);

            db.run('INSERT INTO orders (user_id, items, total, name, surname, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)', [user_id, itemsJSON, total, name, surname, phone, address], function(err) {
                if (err) return res.status(500).json({ error: 'Ошибка оформления заказа' });

                Object.values(userCart).forEach(item => {
                    db.run('UPDATE products SET amount = amount - ? WHERE id = ?', [item.quantity, item.product.id]);
                });

                delete cart[user_id];
                res.json({ success: true });
            });
        } else {
            res.status(400).json({ error: 'Недостаточно товара на складе' });
        }
    });
});

// Информация о доставке (заглушка)
api.get('/api/delivery', (req, res) => {
    res.json({
        info: 'Доставка по России. Сроки и стоимость уточняйте у оператора.'
    });
});

api.listen(API_PORT, () => {
    console.log(`API сервер запущен на порту ${API_PORT}`);
});

// ...existing code...