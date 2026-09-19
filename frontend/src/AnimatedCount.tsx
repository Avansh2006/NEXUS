import { animate, useMotionValue, useReducedMotion, useMotionValueEvent } from "motion/react";
import { useEffect, useState } from "react";

/** Animates actual measured values; assistive technology gets the final count. */
export default function AnimatedCount({value}:{value:number}) {
  const count=useMotionValue(value);
  const reduced=useReducedMotion();
  const [display,setDisplay]=useState(value);
  useMotionValueEvent(count,"change",v=>setDisplay(Math.round(v)));
  useEffect(()=>{const controls=animate(count,value,{duration:reduced?0:.65,ease:[.22,1,.36,1]});return()=>controls.stop();},[count,value,reduced]);
  return <span className="animated-count" aria-label={value.toLocaleString()}><span aria-hidden="true">{display.toLocaleString()}</span></span>;
}
