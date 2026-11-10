import { ENQUIRY_ACT_OPTIONS, ENQUIRY_NIGHTS, ENQUIRY_VENUE_TYPES } from "./acts";

export type MusicBrief = { occasion:string; venue:string; date:string; time:string; guests:string; sound:string; details:string; name:string; email:string; venueType?:string; nightsPerWeek?:string; actType?:string };
export const EMPTY_BRIEF:MusicBrief={occasion:"",venue:"",date:"",time:"",guests:"",sound:"",details:"",name:"",email:"",venueType:"",nightsPerWeek:"",actType:""};
// Qualification answers are stored in English; the copied Thai brief shows the Thai label.
const thaiLabel=(options:readonly {en:string;th:string}[],value="")=>options.find(option=>option.en===value)?.th??value;
export function formatMusicBrief(b:MusicBrief, th=false):string {
 const labels=th?["รูปแบบงาน","ประเภทสถานที่","สถานที่ / เมือง","วันที่","จำนวนคืนต่อสัปดาห์","เวลา / ระยะเวลา","จำนวนแขก","รูปแบบการแสดง","ดนตรี / บรรยากาศ","งบประมาณ อุปกรณ์ และรายละเอียด","ชื่อผู้ติดต่อ","อีเมล"]:["Occasion","Venue type","Venue / city","Date / start date","Nights per week","Time / duration","Guest count","Act type","Sound / atmosphere","Budget, equipment & other details","Contact","Email"];
 const local=(options:readonly {en:string;th:string}[],value?:string)=>th?thaiLabel(options,value):value??"";
 const values=[b.occasion,local(ENQUIRY_VENUE_TYPES,b.venueType),b.venue,b.date||(th?"ยังไม่กำหนด":"To be confirmed"),local(ENQUIRY_NIGHTS,b.nightsPerWeek),b.time,b.guests,local(ENQUIRY_ACT_OPTIONS,b.actType),b.sound,b.details,b.name,b.email];
 return [th?"สวัสดีทีม Bright Ears ขอสอบถามเรื่องดนตรีดังนี้:":"Hi Bright Ears, I’d like to discuss the music for:","",...values.flatMap((v,i)=>v.trim()?[labels[i]+": "+v.trim()]:[])].join("\n");
}
export function briefEmailHref(b:MusicBrief,th=false):string {return "mailto:info@brightears.io?subject="+encodeURIComponent("Music brief — "+b.venue.trim().slice(0,100))+"&body="+encodeURIComponent(formatMusicBrief(b,th));}
