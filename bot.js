require('dotenv').config();

const { Telegraf, Markup, Scenes } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const sqlite3 = require('sqlite3').verbose();

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use((new LocalSession({ database: 'session_db.json' })).middleware());

const db = new sqlite3.Database('./shop.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('Подключено к базе данных SQLite');
    }
});

const cart = {}; // корзины по user_id
const lastActionTime = {}; // антиспам

function isSpam(userId, action = 'default', delay = 2000) {
    const now = Date.now();
    const key = `${userId}_${action}`;
    if (lastActionTime[key] && now - lastActionTime[key] < delay) return true;
    lastActionTime[key] = now;
    return false;
}

bot.start((ctx) => {
    ctx.reply('Добро пожаловать в магазин!', Markup.keyboard([
        ['Каталог'],
        ['Корзина']
    ]).resize());
});

bot.hears('Каталог', async(ctx) => {
    try {
        db.all('SELECT * FROM products', [], (err, rows) => {
            if (err) return ctx.reply('Ошибка загрузки товаров');
            if (!rows.length) return ctx.reply('Товары отсутствуют');

            rows.forEach((product) => {
                if (product.amount > 0) {
                    ctx.reply(
                        `${product.name}\nЦена: ${product.price}₽\nВ наличии: ${product.amount} шт.`,
                        Markup.inlineKeyboard([
                            Markup.button.callback('Добавить в корзину', `buy_${product.id}`)
                        ])
                    );
                } else {
                    ctx.reply(`${product.name}\n❌ Временно нет в наличии`);
                }
            });
        });
    } catch (error) {
        console.error('Ошибка в Каталоге:', error);
        ctx.reply('Произошла ошибка при загрузке каталога.');
    }
});

bot.action(/buy_(\d+)/, async(ctx) => {
    const userId = ctx.from.id;
    if (isSpam(userId, 'buy')) return ctx.answerCbQuery('Подождите немного...');

    try {
        const id = Number(ctx.match[1]);
        db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
            if (err || !product) return ctx.reply('Ошибка при получении товара');

            let userCart = cart[userId] || {};

            if (userCart[id]) {
                if (userCart[id].quantity < product.amount) {
                    userCart[id].quantity += 1;
                    ctx.answerCbQuery(`Добавлено: ${product.name} (x${userCart[id].quantity})`);
                } else {
                    ctx.answerCbQuery(`Нельзя добавить больше ${product.amount} шт.`, { show_alert: true });
                }
            } else {
                if (product.amount > 0) {
                    userCart[id] = { product, quantity: 1 };
                    ctx.answerCbQuery(`Добавлено: ${product.name}`);
                } else {
                    ctx.answerCbQuery('❌ Товара нет в наличии', { show_alert: true });
                }
            }
            cart[userId] = userCart;
        });
    } catch (error) {
        console.error('Ошибка при добавлении в корзину:', error);
        ctx.reply('Ошибка при добавлении в корзину.');
    }
});

bot.hears('Корзина', async(ctx) => {
    const userId = ctx.from.id;
    if (isSpam(userId, 'cart')) return;

    try {
        const userCart = cart[userId] || {};
        if (Object.keys(userCart).length === 0) return ctx.reply('Корзина пуста');

        let total = 0;
        const itemsText = Object.values(userCart).map(item => {
            const subtotal = item.product.price * item.quantity;
            total += subtotal;
            return `${item.product.name} x${item.quantity} - ${subtotal}₽`;
        }).join('\n');

        await ctx.reply(
            `🛒 Ваша корзина:\n\n${itemsText}\n\nИтого: ${total}₽`,
            Markup.inlineKeyboard([Markup.button.callback('Оформить заказ', 'start_checkout')])
        );
    } catch (error) {
        console.error('Ошибка при выводе корзины:', error);
        ctx.reply('Ошибка при загрузке корзины.');
    }
});

const stage = new Scenes.Stage();
const checkoutScene = new Scenes.BaseScene('checkout');

checkoutScene.enter((ctx) => {
    ctx.session.checkoutStep = 'name';
    ctx.reply('Введите ваше имя:');
});

checkoutScene.on('text', (ctx) => {
    if (ctx.message.text.toLowerCase() === 'отмена') {
        ctx.reply('Оформление заказа отменено.');
        return ctx.scene.leave();
    }
    const step = ctx.session.checkoutStep;
    if (step === 'name') {
        ctx.session.name = ctx.message.text;
        ctx.session.checkoutStep = 'surname';
        ctx.reply('Введите вашу фамилию:');
    } else if (step === 'surname') {
        ctx.session.surname = ctx.message.text;
        ctx.session.checkoutStep = 'phone';
        ctx.reply('Введите ваш телефон:');
    } else if (step === 'phone') {
        const phone = ctx.message.text;
        if (isValidPhone(phone)) {
            ctx.session.phone = phone;
            ctx.session.checkoutStep = 'address';
            ctx.reply('Введите адрес доставки:');
        } else {
            ctx.reply('Неверный формат телефона. Попробуйте еще раз:');
        }
    } else if (step === 'address') {
        ctx.session.address = ctx.message.text;
        const userCart = cart[ctx.from.id];
        const total = calculateTotal(userCart);
        const itemsText = Object.values(userCart).map(item => `${item.product.name} x${item.quantity}`).join(', ');
        const summary = `Проверьте данные:\nИмя: ${ctx.session.name}\nФамилия: ${ctx.session.surname}\nТелефон: ${ctx.session.phone}\nАдрес: ${ctx.session.address}\nТовары: ${itemsText}\nИтого: ${total}₽\n\nПодтвердить?`;
        ctx.reply(summary, Markup.inlineKeyboard([
            Markup.button.callback('Да', 'confirm_order'),
            Markup.button.callback('Нет', 'cancel_order')
        ]));
    }
});

checkoutScene.action('confirm_order', (ctx) => {
    const userCart = cart[ctx.from.id];
    const total = calculateTotal(userCart);
    const itemsJSON = JSON.stringify(Object.values(userCart).map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
    })));
    db.run('INSERT INTO orders (user_id, items, total, name, surname, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)', [ctx.from.id, itemsJSON, total, ctx.session.name, ctx.session.surname, ctx.session.phone, ctx.session.address],
        (err) => {
            if (err) {
                console.error('Ошибка при оформлении заказа:', err);
                return ctx.reply('Не удалось оформить заказ.');
            }
            // Обновляем сток
            Object.values(userCart).forEach(item => {
                db.run('UPDATE products SET amount = amount - ? WHERE id = ?', [item.quantity, item.product.id], (err) => {
                    if (err) console.error('Ошибка обновления товара:', err);
                });
            });
            // Инструкции для оплаты
            ctx.reply(`Ваш заказ принят! Пожалуйста, переведите ${total}₽ на карту 1234 5678 9012 3456 и отправьте чек администратору @admin_username.`);
            // Очищаем корзину и сессию
            delete cart[ctx.from.id];
            delete ctx.session.checkoutStep;
            delete ctx.session.name;
            delete ctx.session.surname;
            delete ctx.session.phone;
            delete ctx.session.address;
            return ctx.scene.leave();
        }
    );
});

checkoutScene.action('cancel_order', (ctx) => {
    ctx.reply('Оформление заказа отменено.');
    delete ctx.session.checkoutStep;
    delete ctx.session.name;
    delete ctx.session.surname;
    delete ctx.session.phone;
    delete ctx.session.address;
    return ctx.scene.leave();
});

// Регистрируем сцену
stage.register(checkoutScene);
bot.use(stage.middleware());

bot.action('start_checkout', (ctx) => {
    if (!cart[ctx.from.id] || Object.keys(cart[ctx.from.id]).length === 0) {
        return ctx.reply('Корзина пуста');
    }
    ctx.scene.enter('checkout');
});

function isValidPhone(phone) {
    const phoneRegex = /^\+?\d{10,15}$/;
    return phoneRegex.test(phone);
}

function calculateTotal(userCart) {
    return Object.values(userCart).reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

bot.catch((err, ctx) => {
    console.error(`❗ Ошибка у пользователя ${ctx.from?.username || 'неизвестно'}:`, err);
    ctx.reply('Произошла критическая ошибка. Попробуйте позже.');
});

bot.launch();
module.exports = { db, cart };