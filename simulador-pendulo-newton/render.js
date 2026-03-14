export class Renderer{

constructor(canvas){

this.ctx=canvas.getContext("2d")
this.canvas=canvas

}

drawSistema(sistema){

let ctx=this.ctx

ctx.clearRect(0,0,this.canvas.width,this.canvas.height)

sistema.pendulos.forEach(p=>{

ctx.beginPath()

ctx.moveTo(p.x0,p.y0)
ctx.lineTo(p.x,p.y)

ctx.strokeStyle="white"
ctx.stroke()

ctx.beginPath()

ctx.arc(p.x,p.y,p.radio,0,Math.PI*2)

ctx.fillStyle="#38bdf8"
ctx.fill()

})

}

}
export class GraficoEnergia{

constructor(canvas){

this.ctx=canvas.getContext("2d")
this.canvas=canvas
this.hist=[]

}

update(valor){

this.hist.push(valor)

if(this.hist.length>200)
this.hist.shift()

}

draw(){

let ctx=this.ctx

ctx.clearRect(0,0,this.canvas.width,this.canvas.height)

ctx.beginPath()

this.hist.forEach((v,i)=>{

let x=i*4
let y=100-v

if(i==0) ctx.moveTo(x,y)
else ctx.lineTo(x,y)

})

ctx.strokeStyle="lime"
ctx.stroke()

}

}
