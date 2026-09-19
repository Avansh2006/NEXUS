import {Check,ArrowUpRight,Database,ScanLine,Waypoints} from 'lucide-react';
import {motion} from 'motion/react';

interface Props {loaded:boolean;analyzed:boolean;busy:boolean;onIngest:()=>void;onAnalyze:()=>void;onExplore:()=>void}
export default function InvestigationJourney({loaded,analyzed,busy,onIngest,onAnalyze,onExplore}:Props) {
  const stages=[{label:'Collect evidence',detail:'Raw records, one workspace',icon:Database,done:loaded,action:onIngest,disabled:false},
    {label:'Connect the dots',detail:'Resolve. Analyze. Explain.',icon:ScanLine,done:analyzed,action:onAnalyze,disabled:!loaded||busy},
    {label:'Follow the signal',detail:'Explore every connection',icon:Waypoints,done:false,action:onExplore,disabled:!analyzed}];
  return <div className="journey" aria-label="Investigation workflow">{stages.map((stage,i)=><motion.button key={stage.label} className={`journey-step ${stage.done?'complete':''}`} onClick={stage.action} disabled={stage.disabled} whileHover={{y:-2}} whileTap={{scale:.99}}><span className="journey-index">{stage.done?<Check size={14}/>:String(i+1).padStart(2,'0')}</span><stage.icon size={18}/><span><b>{stage.label}</b><small>{stage.detail}</small></span><ArrowUpRight size={14}/></motion.button>)}</div>;
}
