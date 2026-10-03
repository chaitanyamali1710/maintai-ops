import mongoose, { Schema } from 'mongoose';

// Readings are simulated telemetry, so they are disposable history rather than records of
// record. A TTL index keeps the Atlas free tier (512 MB) from filling up over time.
const READING_TTL_DAYS = Number(process.env.READING_TTL_DAYS || 7);

const userSchema = new Schema({ name:String, email:{type:String,unique:true,index:true}, passwordHash:String, role:{type:String,default:'viewer'} }, {timestamps:true});
const machineSchema = new Schema({ id:{type:String,unique:true,index:true}, name:String, type:String, location:String, status:String, health:Number, nextMaintenance:Date, reading:{type:Schema.Types.Mixed} }, {timestamps:true});
const readingSchema = new Schema({ machineId:{type:String,index:true}, temperature:Number, vibration:Number, pressure:Number, power:Number, rpm:Number, riskScore:Number, timestamp:{type:Date,index:true} });
const alertSchema = new Schema({ id:{type:String,unique:true}, machineId:String, machineName:String, severity:String, title:String, message:String, acknowledged:{type:Boolean,default:false}, createdAt:Date });
const workOrderSchema = new Schema({ id:{type:String,unique:true}, machineId:String, machineName:String, title:String, priority:String, status:String, assignedTo:String, dueDate:Date }, {timestamps:true});

// Serving a chart means "newest 48 for one machine", so index that access pattern directly.
readingSchema.index({ machineId:1, timestamp:-1 });
// Changing READING_TTL_DAYS later needs the old index dropped; Mongoose will not alter it in place.
readingSchema.index({ timestamp:1 }, { expireAfterSeconds: READING_TTL_DAYS*24*60*60 });

export const UserModel = mongoose.model('User', userSchema);
export const MachineModel = mongoose.model('Machine', machineSchema);
export const ReadingModel = mongoose.model('Reading', readingSchema);
export const AlertModel = mongoose.model('Alert', alertSchema);
export const WorkOrderModel = mongoose.model('WorkOrder', workOrderSchema);
