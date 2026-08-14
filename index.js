const express = require('express');
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// stripe
const stripe = require('stripe')
    (process.env.STRIPE_SECRET);



// tracking id
const crypto = require('crypto');

const { getAuth } = require("firebase-admin/auth");

const admin = require("firebase-admin");

// const serviceAccount = require("./zapshift-firebase-adminsdk.json");


// const serviceAccount = require("./firebase-admin-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);


admin.initializeApp({
    credential: admin.cert(serviceAccount)
});




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


const verifyFBToken = async (req, res, next) => {

    console.log('headers in the middleware ', req.headers.authorization)
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }


    try {
        const idToken = token.split(' ')[1];
        const decoded = await getAuth().verifyIdToken(idToken)
        console.log('decoded in the token', decoded);

        req.decoded_email = decoded.email;

        next()
    } catch (error) {
        return res.status(401).send({ message: 'unauthorized access' })
    }


}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.atbpap4.mongodb.net/?appName=Cluster0`;



const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db("delivery_system_db");
        const parcelsCollection = db.collection('parcels');
        const paymentCollection = db.collection('payments');
        const userCollection = db.collection('users');
        const ridersCollection = db.collection('riders');




        // users related apis
        app.post('/users', async (req, res) => {
            const user = req.body;

            user.role = 'user';
            user.createdAt = new Date();

            const email = user.email;
            const userExist = await userCollection.findOne({ email })

            if (userExist) {
                return res.send({ message: 'user exists already' })
            }

            const result = await userCollection.insertOne(user);
            res.send(result)
        })


        app.get('/users', async (req, res) => {

            const cursor = userCollection.find()
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/users/:id', async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await userCollection.findOne(query);
            res.send(result);


        })
        app.get('/user/:email/role', async (req, res) => {

            const email = req.params.email;
            const query = { email: email };

            const user = await userCollection.findOne(query);
            res.send({ "role": user?.role });


        })

        app.patch('/users/:id', async (req, res) => {
            const { role } = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updated = {
                $set: { role }
            }

            const result = await userCollection.updateOne(query, updated);
            res.send(result)
        })


        // riders api

        app.post('/riders', async (req, res) => {
            const rider = req.body;

            const result = await ridersCollection.insertOne(rider)
            res.send(result);


        })

        app.get('/riders', async (req, res) => {
            // 👇 Added email to this line
            const { status, workStatus, district, email } = req.query;
            const query = {};

            // 👇 Added this email filter
            if (email) query.email = email;
            if (status) query.status = status;
            if (district) query.district = { $regex: `^${district}$`, $options: 'i' };
            if (workStatus) query.workStatus = { $regex: `^${workStatus}$`, $options: 'i' };

            const cursor = ridersCollection.find(query).sort({ appliedAt: -1 });
            const result = await cursor.toArray();
            res.send(result);
        });

        app.patch('/riders/:id', async (req, res) => {
            const status = req.body.status;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: status,
                    workStatus: "Unavailable Now"
                }
            }

            const result = await ridersCollection.updateOne(query, updatedDoc);

            if (status === 'approved') {
                const email = req.body.email;
                const userQuery = { email }
                const updateUser = {
                    $set: {
                        role: 'rider'
                    }
                }
                const userResult = await userCollection.updateOne(userQuery, updateUser)
                const userResult2 = await ridersCollection.updateOne(userQuery, updateUser)
            }



            res.send(result);
        })



        // parcel api
        app.get('/parcels', async (req, res) => {
            const query = {};

            // 1. Add riderId here
            const { email, parcelStatus, paymentStatus, riderId } = req.query;

            if (email) {
                query.senderEmail = email;
            }
            if (parcelStatus) {
                query.parcelStatus = parcelStatus;
            }
            if (paymentStatus) {
                query.paymentStatus = paymentStatus;
            }
            // 2. Add riderId filter here
            if (riderId) {
                query.riderId = riderId;
            }

            const cursor = parcelsCollection.find(query).sort({ createdAt: -1 });
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/parcels/:id', async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await parcelsCollection.findOne(query);
            res.send(result);


        })


        app.patch('/parcels/:id', async (req, res) => {
            const { riderId, riderName, riderPhone } = req.body;
            const id = req.params.id;

            const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });

            if (!parcel) {
                return res.status(404).send({ message: 'Parcel not found' });
            }

            if (parcel.paymentStatus !== 'paid') {
                return res.status(400).send({ message: 'Cannot assign a rider to an unpaid parcel' });
            }

            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    parcelStatus: 'rider-assigned',   // was deliveryStatus — must match the field your GET query filters on
                    riderId: riderId,
                    riderName: riderName,
                    riderPhone: riderPhone,
                },
            };

            const result = await parcelsCollection.updateOne(query, updatedDoc);

            const riderQuery = { _id: new ObjectId(riderId) };
            const riderUpdatedDoc = {
                $set: {
                    workStatus: 'in-transit',
                },
            };

            const riderResult = await ridersCollection.updateOne(riderQuery, riderUpdatedDoc);

            res.send({
                modifiedCount: result.modifiedCount,
                riderModifiedCount: riderResult.modifiedCount,
            });
        });

        app.patch('/parcels/:id/status', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;

            const validStatuses = ['picked-up', 'in-transit', 'delivered', 'failed-attempt'];
            if (!validStatuses.includes(status)) {
                return res.status(400).send({ message: 'Invalid status' });
            }

            const query = { _id: new ObjectId(id) };
            const updatedDoc = { $set: { parcelStatus: status } };

            const result = await parcelsCollection.updateOne(query, updatedDoc);

            // free the rider up once the parcel is off their plate
            if (status === 'delivered' || status === 'failed-attempt') {
                const parcel = await parcelsCollection.findOne(query);
                if (parcel?.riderId) {
                    await ridersCollection.updateOne(
                        { _id: new ObjectId(parcel.riderId) },
                        { $set: { workStatus: 'Available' } }
                    );
                }
            }

            res.send(result);
        });

        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            parcel.createdAt = new Date();

            const result = await parcelsCollection.insertOne(parcel);
            res.send(result)
        })


        app.delete('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await parcelsCollection.deleteOne(query);
            res.send(result);
        })


        // tracking
        // public tracking — no auth, looked up by trackingId not _id
        app.get('/track/:trackingId', async (req, res) => {
            const trackingId = req.params.trackingId;
            const query = { trackingId: trackingId };

            const parcel = await parcelsCollection.findOne(query);

            if (!parcel) {
                return res.status(404).send({ message: 'No parcel found with this tracking ID' });
            }


            const trackingInfo = {
                parcelName: parcel.parcelName,
                parcelType: parcel.parcelType,
                parcelStatus: parcel.parcelStatus,
                paymentStatus: parcel.paymentStatus,
                cost: parcel.cost,
                senderRegion: parcel.senderRegion,
                recieverRegion: parcel.recieverRegion,
                trackingId: parcel.trackingId,
                createdAt: parcel.createdAt,
                riderName: parcel.riderName,
                riderPhone: parcel.riderPhone,
            };

            res.send(trackingInfo);
        });


        // payment related apis
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt((paymentInfo.cost) * 100)
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
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
                // Provide a name (for example, hosted_web_0001) to label this Checkout integration and measure its conversion independently
                // integration_identifier: '{{INTEGRATION_ID}}',
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



            const query = { transactionId: transactionId }
            const alreadyExists = await paymentCollection.findOne(query);


            if (alreadyExists) {

                // console.log('already exists')
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
                const query = { _id: new ObjectId(id) };
                const update = {
                    $set: {
                        paymentStatus: "paid",
                        trackingId: trackingId,
                        transactionId: transactionId,
                        parcelStatus: "pendingPickup"
                    },


                }





                const result = await parcelsCollection.updateOne(query, update);


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

                if (session.payment_status === 'paid') {
                    const resultPayment = await paymentCollection.insertOne(payment);
                    res.send({
                        success: true,
                        modifyParcel: result,
                        trackingId: trackingId,
                        transactionId: session.payment_intent,
                        paymentInfo: resultPayment
                    })
                }

            }
            res.send({ success: false })
        })



        app.get('/payment-history', verifyFBToken, async (req, res) => {

            const query = {};
            const email = req.query.email;

            console.log('headers ', req.headers)

            if (email) {
                query.senderEmail = email;

                if (email !== req.decoded_email) {
                    return res.status(403).send({ message: 'forbidden access' });
                }
            }

            const cursor = paymentCollection.find(query).sort({ paidAt: -1 })
            const result = await cursor.toArray();
            res.send(result)

        })
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
        //rahel
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
