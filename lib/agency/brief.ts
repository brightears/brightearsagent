export type MusicBrief = { occasion:string; venue:string; date:string; time:string; guests:string; sound:string; details:string; name:string; email:string };
export const EMPTY_BRIEF:MusicBrief={occasion:"",venue:"",date:"",time:"",guests:"",sound:"",details:"",name:"",email:""};
export function formatMusicBrief(b:MusicBrief, th=false):string {
 const labels=th?["รูปแบบงาน","สถานที่ / เมือง","วันที่","เวลา / ระยะเวลา","จำนวนแขก","ดนตรี / บรรยากาศ","งบประมาณ อุปกรณ์ และรายละเอียด","ชื่อผู้ติดต่อ","อีเมล"]:["Occasion","Venue / city","Date / start date","Time / duration","Guest count","Sound / atmosphere","Budget, equipment & other details","Contact","Email"];
 const values=[b.occasion,b.venue,b.date||(th?"ยังไม่กำหนด":"To be confirmed"),b.time,b.guests,b.sound,b.details,b.name,b.email];
 return [th?"สวัสดีทีม Bright Ears ขอสอบถามเรื่องดนตรีดังนี้:":"Hi Bright Ears, I’d like to discuss the music for:","",...values.flatMap((v,i)=>v.trim()?[labels[i]+": "+v.trim()]:[])].join("\n");
}
export function briefEmailHref(b:MusicBrief,th=false):string {return "mailto:info@brightears.io?subject="+encodeURIComponent("Music brief — "+b.venue.trim().slice(0,100))+"&body="+encodeURIComponent(formatMusicBrief(b,th));}
