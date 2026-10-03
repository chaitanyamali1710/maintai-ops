import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { z } from 'zod';
import { allow, requireAuth, sign } from './auth.js';
import { acknowledgeAlert, createWorkOrder, getMachine, getMachines, getAlerts, getWorkOrders } from './repository.js';

export const app=express();
app.disable('x-powered-by');
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin:(process.env.CLIENT_URL||'http://localhost:5173').split(','),credentials:true}));
app.use(express.json({limit:'250kb'}));
app.use(morgan(process.env.NODE_ENV==='test'?'tiny':'combined'));
app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false}));

const demoHash=await bcrypt.hash('Admin@123',10);
const loginSchema=z.object({email:z.string().email(),password:z.string().min(8).max(72)});
app.post('/api/auth/login',async(req,res)=>{const parsed=loginSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Enter a valid email and password'});const valid=parsed.data.email.toLowerCase()==='admin@maintai.dev'&&await bcrypt.compare(parsed.data.password,demoHash);if(!valid)return res.status(401).json({message:'Incorrect email or password'});const user={id:'USR-001',name:'Chaitanya Mali',email:'admin@maintai.dev',role:'admin' as const};res.json({token:sign(user),user});});
app.get('/api/health',(_req,res)=>res.json({status:'ok',service:'maintai-api',timestamp:new Date().toISOString()}));

app.use('/api',requireAuth);
app.get('/api/dashboard',async(_req,res,next)=>{try{const [machines,alerts,workOrders]=await Promise.all([getMachines(),getAlerts(),getWorkOrders()]);const activeAlerts=alerts.filter(a=>!a.acknowledged).length;res.json({machines,alerts,workOrders,metrics:{totalMachines:machines.length,operational:machines.filter(m=>m.status==='healthy').length,activeAlerts,averageHealth:Math.round(machines.reduce((s,m)=>s+m.health,0)/machines.length),avoidedDowntimeHours:37}});}catch(err){next(err);}});
app.get('/api/machines',async(_req,res,next)=>{try{res.json(await getMachines());}catch(err){next(err);}});
app.get('/api/machines/:id',async(req,res,next)=>{try{const m=await getMachine(req.params.id);return m?res.json(m):res.status(404).json({message:'Machine not found'});}catch(err){next(err);}});
app.patch('/api/alerts/:id/acknowledge',async(req,res,next)=>{try{const a=await acknowledgeAlert(req.params.id);return a?res.json(a):res.status(404).json({message:'Alert not found'});}catch(err){next(err);}});
const orderSchema=z.object({machineId:z.string().min(2).max(30),title:z.string().min(4).max(160),priority:z.enum(['low','medium','high']),assignedTo:z.string().min(2).max(80)});
app.post('/api/work-orders',allow('admin','manager','technician'),async(req,res,next)=>{const parsed=orderSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Invalid work order',issues:parsed.error.flatten()});try{const m=await getMachine(parsed.data.machineId);const order={id:`WO-${Date.now().toString().slice(-5)}`,machineId:parsed.data.machineId,machineName:m?.name||parsed.data.machineId,title:parsed.data.title,priority:parsed.data.priority,status:'open',assignedTo:parsed.data.assignedTo,dueDate:new Date(Date.now()+2*86400000).toISOString()};await createWorkOrder(order);res.status(201).json(order);}catch(err){next(err);}});
app.post('/api/ai/analyze/:machineId',async(req,res)=>{const m=await getMachine(req.params.machineId);if(!m)return res.status(404).json({message:'Machine not found'});try{const {data}=await axios.post(`${process.env.AI_SERVICE_URL||'http://localhost:8000'}/analyze`,m.reading,{timeout:10000});res.json(data);}catch{res.status(503).json({message:'AI service unavailable'});}});
const aiUrl=()=>process.env.AI_SERVICE_URL||'http://localhost:8000';
app.get('/api/replay/scenarios',async(_req,res)=>{try{const {data}=await axios.get(`${aiUrl()}/replay/scenarios`,{timeout:10000});res.json(data);}catch{res.status(503).json({message:'AI service unavailable'});}});
const replaySchema=z.object({scenario:z.string().min(2).max(40),index:z.number().int().min(0)});
app.post('/api/replay/step',async(req,res)=>{const parsed=replaySchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Invalid replay step'});try{const {data}=await axios.post(`${aiUrl()}/replay/step`,parsed.data,{timeout:15000});res.json(data);}catch(err){const status=axios.isAxiosError(err)&&err.response?.status===404?404:503;res.status(status).json({message:status===404?'Unknown replay scenario':'AI service unavailable'});}});
app.get('/api/model',async(_req,res)=>{try{const {data}=await axios.get(`${aiUrl()}/model`,{timeout:10000});res.json(data);}catch{res.status(503).json({message:'AI service unavailable'});}});

const askSchema=z.object({question:z.string().min(4).max(1000),machineId:z.string().optional()});
app.post('/api/ai/ask',async(req,res)=>{const parsed=askSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Enter a valid question'});const all=await getMachines();const machine=all.find(m=>m.id===parsed.data.machineId)||all[0];try{const {data}=await axios.post(`${process.env.AI_SERVICE_URL||'http://localhost:8000'}/ask`,{...parsed.data,telemetry:machine?.reading},{timeout:20000});res.json(data);}catch{res.status(503).json({message:'AI service unavailable'});}});
app.use((_req,res)=>res.status(404).json({message:'Route not found'}));
app.use((err:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(500).json({message:process.env.NODE_ENV==='production'?'Unexpected server error':err.message});});
