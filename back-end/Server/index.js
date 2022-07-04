import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { v4 as uuid } from 'uuid';
import joi from "joi";


const server = express();
server.use(express.json());
server.use(cors());


let mongoClient;
let DB;

async function dbConection () {
    mongoClient = new MongoClient("mongodb://127.0.0.1:27017");
    await mongoClient.connect();
    DB = mongoClient.db("MyWallet");
}
dbConection ();

server.post("/cadastro", async (request, response) => {
    const user = request.body;

    const userSchema = joi.object({
        name: joi.string().required(),
        email: joi.string().email().required(),
        password: joi.string().required(),
    });

    const { error } = userSchema.validate(user);
    
    if (error) {
        response.status(400).send("Campos preenchidos incorretamente");
        return;
    }
    const verifyingEmail = await DB.collection("usuarios").findOne({ email: user.email });
    if (verifyingEmail) {
        response.status(409).send("Email já em uso!");
        return;
    }
    const criptoPassword = bcrypt.hashSync(user.password, 10);
    await DB.collection("usuarios").insertOne({ ...user, password: criptoPassword });
    response.status(201).send("Usuário criado com sucesso");
});

server.post("/login", async (request, response) => {
    const user = request.body;

    const userSchema = joi.object({
        email: joi.string().email().required(),
        password: joi.string().required(),
    });
    
    const { error } = userSchema.validate(user);

    if (error) {
        response.status(422).send("Campos preenchidos incorretamente");
        return
    }
    const userDB = await DB.collection("usuarios").findOne({ email: user.email });

    if(!userDB) {
        response.status(404).send("Usuário não encontrado");
        return;
    }
    const verifyingPassword = bcrypt.compareSync(user.password, userDB.password);

    if (!verifyingPassword) {
        response.status(401).send("Senha ou email incorretos!");
        return;
    }

    const token = uuid();
    await DB.collection("sessoes").insertOne({
        token,
        userId: userDB._id
    })
    
    response.status(201).send({ token });

});

server.get("/items", async (request, response) => {
    const { authorization } = request.headers;
    const token = authorization?.replace("Bearer ", "");

    const session = await DB.collection("sessoes").findOne({ token });

    if(!session) {
        return response.sendStatus(401);
    }
    
    const items = await DB.collection("items").find({ userId: new ObjectId(session.userId) }).toArray();
    response.send(items);
});

server.get("/user", async (request, response) => {
    const { authorization } = request.headers;
    const token = authorization?.replace("Bearer ", "");

    const session = await DB.collection("sessoes").findOne({ token });
    if(!session) {
        return response.sendStatus(401);
    }
    
    const usuario = await DB.collection("usuarios").find({ _id: new ObjectId(session.userId) }).toArray();
    
    response.send(usuario[0].name);
    
});

server.post("/item", async (request, response) => {
    const item = request.body;
    const { authorization } = request.headers;
    const token = authorization?.replace("Bearer ", "");


    if (!item.date || !item.description || !item.value) {
        response.status(422).send("Campos preenchidos incorretamente");
        return;
    }

    const session = await DB.collection("sessoes").findOne({ token });

    if(!session) {
        response.status(401).send("Usuário não encontrado");
        return;
    }
   await DB.collection("items").insertOne({ ...item, userId: new ObjectId(session.userId) });

    
    response.status(201).send("Post criado com sucesso");

});










server.listen(5001);