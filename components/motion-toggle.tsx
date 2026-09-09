"use client";
import {useEffect,useState} from "react";
export function MotionToggle({th}:{th:boolean}){
 const [paused,setPaused]=useState(false);
 useEffect(()=>{document.documentElement.dataset.agencyPaused=String(paused);return()=>{delete document.documentElement.dataset.agencyPaused;};},[paused]);
 return <button type="button" aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?(th?"เล่นภาพเคลื่อนไหว":"Play motion"):(th?"หยุดภาพเคลื่อนไหว":"Pause motion")} <span aria-hidden>{paused?"▷":"Ⅱ"}</span></button>;
}
