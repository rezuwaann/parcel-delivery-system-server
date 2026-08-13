const express = require('express');
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3001;
require('dotenv').config();
const mysql = require('mysql2/promise');

// stripe
const stripe = require('stripe')
    (process.env.STRIPE_SECRET);



// tracking id
const crypto = require('crypto');

const generateTrackingId = () => {
    const prefix = "DX";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();

    return `${prefix}-${date}-${random}`;
};

console.log('this is tracking id =', generateTrackingId());




// const middleware
app.use(express.json())
app.use(cors())


let db;

async function run() {
    try {
      db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'delivery_system_db'
});
        console.log("Connected to MySQL successfully!");


        // parcel api
        app.get('/parcels', async (req, res) => {
            const { email } = req.query;

            let sql = 'SELECT * FROM parcels ORDER BY createdAt DESC';
            let params = [];

            if (email) {
                sql = 'SELECT * FROM parcels WHERE senderEmail = ? ORDER BY createdAt DESC';
                params = [email];
            }

            const [rows] = await db.query(sql, params);
            res.send(rows);
        })

        app.get('/parcels/:id', async (req, res) => {
            const id = req.params.id;

            const [rows] = await db.query('SELECT * FROM parcels WHERE id = ?', [id]);
            res.send(rows[0]);
        })

        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            parcel.createdAt = new Date();

            const [result] = await db.query('INSERT INTO parcels SET ?', [parcel]);
            res.send(result);
        })


        app.delete('/parcels/:id', async (req, res) => {
            const id = req.params.id;

            const [result] = await db.query('DELETE FROM parcels WHERE id = ?', [id]);
            res.send(result);
        })




        // payment related apis
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt((paymentInfo.cost) * 100)
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'bdt',
                            unit_amount: amount,
                            product_data: {
                                name: paymentInfo.parcelName
                            }
                        },
                        quantity: 1,
                    },
                ],
                customer_email: paymentInfo.senderEmail,
                mode: 'payment',
                metadata: {
                    parcelId: paymentInfo.parcelId,
                    parcelName: paymentInfo.parcelName
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
            });

            console.log(session)
            res.send({ url: session.url })
        })


        app.patch('/payment-success', async (req, res) => {
            const sessionId = req.query.session_id;
            const trackingId = generateTrackingId();

            const session = await stripe.checkout.sessions.retrieve(sessionId);

            const transactionId = session.payment_intent;
            const amount = session.amount_total;

            const [existingRows] = await db.query(
                'SELECT * FROM payments WHERE transactionId = ?',
                [transactionId]
            );

            if (existingRows.length > 0) {
                console.log('already exists')
                return res.send({
                    message: "already exists",
                    transactionId,
                    trackingId: trackingId,
                    cost: amount / 100
                })
            } else console.log('doesnt existss')


            console.log('session retrieve', session)

            if (session.payment_status === 'paid') {
                const id = session.metadata.parcelId;

                const [result] = await db.query(
                    'UPDATE parcels SET paymentStatus = ?, trackingId = ?, transactionId = ? WHERE id = ?',
                    ['paid', trackingId, transactionId, id]
                );

                const payment = {
                    cost: amount / 100,
                    currency: session.currency,
                    senderEmail: session.customer_email,
                    parcelId: session.metadata.parcelId,
                    parcelName: session.metadata.parcelName,
                    transactionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    trackingId: trackingId,
                    paidAt: new Date(),
                }

                const [resultPayment] = await db.query('INSERT INTO payments SET ?', [payment]);

                return res.send({
                    success: true,
                    modifyParcel: result,
                    trackingId: trackingId,
                    transactionId: session.payment_intent,
                    paymentInfo: resultPayment
                })
            }

            res.send({ success: false })
        })



        app.get('/payment-history', async (req, res) => {
            let sql = 'SELECT * FROM payments';
            let params = [];

            if (req.query.email) {
                sql = 'SELECT * FROM payments WHERE senderEmail = ?';
                params = [req.query.email];
            }

            const [rows] = await db.query(sql, params);
            res.send(rows);
        })

    } catch (err) {
        console.error("MySQL connection error:", err);
    }
}
run();




app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})