import {SistemaPendulos,CollisionStrategy} from "./fisica.js"
import {Renderer,GraficoEnergia} from "./render.js"

const canvas=document.getElementById("canvas")
const grafCanvas=document.getElementById("grafico")

const renderer=new Renderer(canvas)
const grafico=new GraficoEnergia(grafCanvas)

let num=5
let masa=2
let e=1

let sistema=new SistemaPendulos(num,masa)

let strategy=new CollisionStrategy(e)

const g=9.8
const dt=0.016

// CONTROLES

document.getElementById("numPendulos").oninput=(ev)=>{

num=Number(ev.target.value)

document.getElementById("numLabel").innerText=num

sistema=new SistemaPendulos(num,masa)

}

document.getElementById("masa").oninput=(ev)=>{

masa=Number(ev.target.value)

document.getElementById("masaLabel").innerText=masa

sistema=new SistemaPendulos(num,masa)

}

document.getElementById("restitucion").oninput=(ev)=>{

e=Number(ev.target.value)

document.getElementById("restLabel").innerText=e

strategy=new CollisionStrategy(e)

}

document.getElementById("reset").onclick=()=>{

sistema=new SistemaPendulos(num,masa)

}

// ARRASTRAR CON MOUSE

let seleccionado=null

canvas.onmousedown=(ev)=>{

let rect=canvas.getBoundingClientRect()

let mx=ev.clientX-rect.left
let my=ev.clientY-rect.top

sistema.pendulos.forEach(p=>{

let dx=mx-p.x
let dy=my-p.y

if(Math.sqrt(dx*dx+dy*dy)<p.radio){

seleccionado=p

}

})

}

canvas.onmousemove=(ev)=>{

if(seleccionado){

let rect=canvas.getBoundingClientRect()

let mx=ev.clientX-rect.left

let dx=mx-seleccionado.x0

seleccionado.angulo=Math.asin(dx/seleccionado.longitud)

seleccionado.velocidadAngular=0

}

}

canvas.onmouseup=()=>{

seleccionado=null

}

// LOOP

function loop(){

sistema.update(g,dt,strategy)

renderer.drawSistema(sistema)

grafico.update(sistema.energiaTotal())

grafico.draw()

requestAnimationFrame(loop)

}

loop()
