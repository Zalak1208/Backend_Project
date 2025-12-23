//require('dotenv').config({path:'./env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js"
import {app} from "./app.js"

dotenv.config({
    path: './env'
})

app.on("error", (error) => {
    console.log("ERROR:", error);
    throw error;
});

connectDB() // bcz connectBD return the promise 
.then(() => {
    app.listen(process.env.PORT || 8000 , ()=>{
        console.log(`Server is Running at PORT : ${process.env.PORT}`);
    }) 
})
.catch((err)=>{
    console.log("MONGO DB Connection Failed!!!" , err)
})









/*
import express from 'express'
const app = express()


// function connectDB(){

// }
// connectDB()

;(async () => {
    try{
       await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
       app.on("error" , (error) => {
        console.log("ERROR : " , error);
        throw error;
       })
       app.listen(process.env.PORT , () => {
        console.log(`App is listening on port ${process.env.PORT}`)
       })
    }
    catch(error){
        console.error("ERROR : " , error)
        throw error
    }
})()

*/