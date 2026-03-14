export class Pendulo{

constructor(x0,y0,longitud,masa,radio){

this.x0=x0
this.y0=y0

this.longitud=longitud
this.masa=masa
this.radio=radio

this.angulo=0
this.velocidadAngular=0

this.x=0
this.y=0

}

update(g,dt){

let a = -(g/this.longitud)*Math.sin(this.angulo)

this.velocidadAngular += a*dt
this.angulo += this.velocidadAngular*dt

this.x = this.x0 + this.longitud*Math.sin(this.angulo)
this.y = this.y0 + this.longitud*Math.cos(this.angulo)

}

velocidadLineal(){
return this.longitud*this.velocidadAngular
}

energia(){

let v = this.velocidadLineal()

return 0.5*this.masa*v*v

}

}
export class CollisionStrategy{

constructor(e){
this.e = e
}

resolver(p1,p2){

let v1 = p1.velocidadLineal()
let v2 = p2.velocidadLineal()

let m1 = p1.masa
let m2 = p2.masa

let e = this.e

let v1p = (m1*v1+m2*v2-m2*e*(v1-v2))/(m1+m2)
let v2p = (m1*v1+m2*v2+m1*e*(v1-v2))/(m1+m2)

p1.velocidadAngular = v1p/p1.longitud
p2.velocidadAngular = v2p/p2.longitud

}

}
export class SistemaPendulos{

constructor(n,masa){

this.n=n
this.masa=masa
this.crearPendulos()

}

crearPendulos(){

this.pendulos=[]

let startX=300
let sep=40

for(let i=0;i<this.n;i++){

this.pendulos.push(
new Pendulo(startX+i*sep,80,200,this.masa,15)
)

}

}

energiaTotal(){

let total=0

this.pendulos.forEach(p=>{

total+=p.energia()

})

return total

}

update(g,dt,strategy){

this.pendulos.forEach(p=>p.update(g,dt))

for(let i=0;i<this.pendulos.length-1;i++){

let p1=this.pendulos[i]
let p2=this.pendulos[i+1]

let dx=p1.x-p2.x
let dy=p1.y-p2.y

let dist=Math.sqrt(dx*dx+dy*dy)

if(dist <= p1.radio+p2.radio){

strategy.resolver(p1,p2)

}

}

}

}
