// Small linear/Boolean model builder. No nonlinear SCIP expressions are emitted.
export class LinearModel {
  constructor(){this.variables=new Map();this.constraints=[];this.serial=0;this.constraintSerial=0;this.booleanCache=new Map();this.booleanNodes=new Map();this.negations=new Map();}
  variable(prefix,lower=0,upper=1,type='binary'){
    const name=prefix+'_'+(++this.serial);this.variables.set(name,{name,lower,upper,type});return name;
  }
  expression(value){return typeof value==='number'?{constant:value,terms:new Map()}:typeof value==='string'?{constant:0,terms:new Map([[value,1]])}:value;}
  add(...values){const result={constant:0,terms:new Map()};for(const value of values){const e=this.expression(value);result.constant+=e.constant;for(const [name,c] of e.terms)result.terms.set(name,(result.terms.get(name)??0)+c);}for(const [name,c] of result.terms)if(c===0)result.terms.delete(name);return result;}
  scale(value,factor){const e=this.expression(value);return {constant:e.constant*factor,terms:new Map([...e.terms].map(([name,c])=>[name,c*factor]))};}
  bounds(value){const e=this.expression(value);let lower=e.constant,upper=e.constant;for(const [name,c] of e.terms){const v=this.variables.get(name);if(!v)throw Error('Unknown variable '+name);lower+=c*(c<0?v.upper:v.lower);upper+=c*(c<0?v.lower:v.upper);}return {lower,upper};}
  constrain(value,sense,bound,label='c'){const e=this.expression(value);this.constraints.push({name:label+'_'+(++this.constraintSerial),expression:{...e,constant:0},sense,bound:bound-e.constant});}
  not(value){if(typeof value==='number')return 1-value;if(this.negations.has(value))return this.negations.get(value);const result=this.variable('not');this.constrain(this.add(value,result),'==',1);this.negations.set(value,result);this.negations.set(result,value);this.booleanNodes.set(result,{kind:'not',args:[value]});return result;}
  bool(kind,values){
    const absorbing=kind==='and'?0:1,neutral=1-absorbing;
    let args=[];
    for(const value of values){if(value===absorbing)return absorbing;if(value===neutral)continue;const node=this.booleanNodes.get(value);if(node?.kind===kind)args.push(...node.args);else args.push(value);}
    args=[...new Set(args)].sort();
    if(args.some(v=>args.includes(this.negations.get(v))))return absorbing;
    // Absorption: a OR (a AND b) == a, and its dual.
    args=args.filter(v=>{const n=this.booleanNodes.get(v);return !(n&&n.kind!=='not'&&n.kind!==kind&&n.args.some(x=>args.includes(x)));});
    if(!args.length)return neutral;if(args.length===1)return args[0];
    const key=kind+':'+args.join(',');if(this.booleanCache.has(key))return this.booleanCache.get(key);
    const result=this.variable(kind),sum=this.add(...args);
    if(kind==='and'){for(const v of args)this.constrain(this.add(result,this.scale(v,-1)),'<=',0);this.constrain(this.add(result,this.scale(sum,-1)),'>=',1-args.length);}
    else{for(const v of args)this.constrain(this.add(result,this.scale(v,-1)),'>=',0);this.constrain(this.add(result,this.scale(sum,-1)),'<=',0);}
    this.booleanCache.set(key,result);this.booleanNodes.set(result,{kind,args});return result;
  }
  and(...values){return this.bool('and',values);}
  or(...values){return this.bool('or',values);}
  product(binary,value,prefix='product'){
    if(binary===0)return 0;if(binary===1)return value;
    if(typeof value==='string'&&this.variables.get(value)?.type==='binary')return this.and(binary,value);
    const e=this.expression(value);if(!e.terms.size)return this.scale(binary,e.constant);
    const {lower,upper}=this.bounds(e);if(!Number.isFinite(lower)||!Number.isFinite(upper))throw Error('Finite product bounds required');
    const y=this.variable(prefix,Math.min(0,lower),Math.max(0,upper),'continuous');
    this.constrain(this.add(y,this.scale(binary,-lower)),'>=',0);
    this.constrain(this.add(y,this.scale(binary,-upper)),'<=',0);
    this.constrain(this.add(y,this.scale(e,-1),this.scale(binary,-upper)),'>=',-upper);
    this.constrain(this.add(y,this.scale(e,-1),this.scale(binary,-lower)),'<=',-lower);
    return y;
  }
  define(prefix,value,lower,upper,type='continuous'){
    const bounds=this.bounds(value),v=this.variable(prefix,lower??bounds.lower,upper??bounds.upper,type);
    this.constrain(this.add(v,this.scale(value,-1)),'==',0,prefix);return v;
  }
  cip(objective=0){
    const goal=this.expression(objective),coefficient=new Map(goal.terms);
    const number=x=>{if(!Number.isFinite(x))throw Error('Non-finite coefficient');return String(Object.is(x,-0)?0:x);};
    const terms=e=>[...e.terms].map(([name,c])=>(c>=0?'+':'')+number(c)+' <'+name+'>').join(' ')||'0 <'+this.variables.keys().next().value+'>';
    if(!this.variables.size)this.variable('dummy',0,0,'integer');
    return 'STATISTICS\n  Problem name : df-full-weapon\nOBJECTIVE\n  Sense : minimize\nVARIABLES\n'+[...this.variables.values()].map(v=>`  [${v.type}] <${v.name}>: obj=${number(coefficient.get(v.name)??0)}, original bounds=[${number(v.lower)},${number(v.upper)}]`).join('\n')+'\nCONSTRAINTS\n'+this.constraints.map(c=>`  [linear] <${c.name}>: ${terms(c.expression)} ${c.sense} ${number(c.bound)};`).join('\n')+'\nEND\n';
  }
}
