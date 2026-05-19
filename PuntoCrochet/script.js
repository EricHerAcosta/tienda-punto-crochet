const carrito = [];

const botonesAgregar = document.querySelectorAll(".botonAgregar");
const botonEnviar = document.getElementById("enviarPedido");
const listaCarrito = document.getElementById("listaCarrito");
const totalCarrito = document.getElementById("totalCarrito");

botonesAgregar.forEach(boton => {
  boton.addEventListener("click", () => {
    const nombre = boton.dataset.nombre;
    const precio = Number(boton.dataset.precio);

    carrito.push({ nombre, precio });

    actualizarCarrito();
  });
});

function actualizarCarrito() {
  listaCarrito.innerHTML = "";
  let total = 0;

  carrito.forEach((producto, index) => {
    const item = document.createElement("li");
    item.textContent = `${producto.nombre} - $${producto.precio}`;

    const botonEliminar = document.createElement("button");
    botonEliminar.textContent = "❌";
    botonEliminar.style.marginLeft = "10px";

    botonEliminar.addEventListener("click", () => {
      carrito.splice(index, 1);
      actualizarCarrito();
    });

    item.appendChild(botonEliminar);
    listaCarrito.appendChild(item);

    total += producto.precio;
  });

  totalCarrito.textContent = `Total: $${total}`;
}

botonEnviar.addEventListener("click", () => {
  if (carrito.length === 0) {
    alert("El carrito está vacío 🧶");
    return;
  }

  let mensaje = "Hola, quiero hacer un pedido 🧶%0A%0A";
  let total = 0;

  carrito.forEach(producto => {
    mensaje += `- ${producto.nombre} – $${producto.precio}%0A`;
    total += producto.precio;
  });

  mensaje += `%0A Total: $${total}`;

  const telefono = "573001234567"; // CAMBIA ESTE NÚMERO
  const url = `https://wa.me/${telefono}?text=${mensaje}`;

  window.open(url, "_blank");
});
