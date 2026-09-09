"use client";
import {useEffect,useRef} from "react";
export function AgencyMotion({children}:{children:React.ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target);}}),{threshold:.12});
  root.current.querySelectorAll("[data-reveal]").forEach(el=>observer.observe(el));
  root.current.dataset.motion="ready";
  return()=>observer.disconnect();
 },[]);
 return <div ref={root}>{children}</div>;
}
