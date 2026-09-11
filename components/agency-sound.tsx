"use client";
import {useState} from "react";
import styles from "@/app/(marketing)/agency.module.css";
const SOUNDS=[
 {name:["Warm & relaxed","อบอุ่นและผ่อนคลาย"],moment:["Dinner / conversation / sunset","ดินเนอร์ / บทสนทนา / ยามเย็น"],title:["Room to settle in.","บรรยากาศที่ทำให้รู้สึกสบาย"],body:["Soul, jazz textures and laid-back grooves. A starting point for rooms where the conversation matters as much as the music.","โซล กลิ่นอายแจ๊ส และจังหวะสบาย ๆ จุดเริ่มต้นสำหรับพื้นที่ที่ให้ความสำคัญกับบทสนทนาพอ ๆ กับดนตรี"]},
 {name:["Social & upbeat","สดใสและเป็นกันเอง"],moment:["Cocktails / rooftops / weekend brunch","ค็อกเทล / รูฟท็อป / บรันช์"],title:["A little more movement.","เติมจังหวะให้บรรยากาศ"],body:["Disco, funk and soulful house. A brighter direction for the moment guests arrive, mingle and stay for another round.","ดิสโก้ ฟังก์ และโซลฟูลเฮาส์ แนวทางที่สดใสสำหรับช่วงที่แขกเริ่มมาถึง พบปะ และใช้เวลาด้วยกัน"]},
 {name:["Dancefloor energy","สนุกบนฟลอร์เต้นรำ"],moment:["Celebrations / launches / late nights","งานฉลอง / งานเปิดตัว / ค่ำคืน"],title:["Let the night open up.","ปล่อยให้ค่ำคืนได้สนุกเต็มที่"],body:["House, disco and familiar favourites, shaped around the crowd. Tell us what you love—and what you’d rather never hear.","เฮาส์ ดิสโก้ และเพลงคุ้นเคย ปรับให้เข้ากับผู้ฟัง บอกเราว่าคุณชอบอะไร และไม่อยากได้ยินเพลงแบบไหน"]}
];
export function AgencySound({th}:{th:boolean}){
 const [selected,setSelected]=useState(0),i=th?1:0,sound=SOUNDS[selected];
 return <div className={styles.soundBox}><div className={styles.soundChoices} role="group" aria-label={th?"เลือกบรรยากาศดนตรี":"Choose a music atmosphere"}>{SOUNDS.map((item,index)=><button key={item.name[0]} type="button" aria-pressed={selected===index} onClick={()=>setSelected(index)}><span>0{index+1}</span>{item.name[i]}<span aria-hidden>↗</span></button>)}</div><div className={styles.soundDetail} aria-live="polite"><p className={styles.eyebrow}>{sound.moment[i]}</p><h3>{sound.title[i]}</h3><p>{sound.body[i]}</p><a className={styles.textLink} href="#brief" onClick={()=>window.dispatchEvent(new CustomEvent("be:brief-sound",{detail:sound.name[i]}))}>{th?"ใช้แนวทางนี้ในบรีฟ":"Use this direction in my brief"} ↗</a></div></div>;
}
