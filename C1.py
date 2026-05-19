import sys
import math
import random
import pygame

# ------------------ Configuración general ------------------
ANCHO, ALTO = 1200, 680
FPS = 60
GRAVEDAD = 1500.0            # px/s^2
SUELO_Y = ALTO - 60          # altura del suelo
COLOR_CIELO = (200, 230, 255)
COLOR_SUELO = (120, 85, 60)
COLOR_BANDA = (90, 50, 30)

# Resortera
SLING_ANCLA = pygame.Vector2(180, SUELO_Y - 100)
SLING_MAX_ESTIRON = 150       # radio máximo de estiramiento
SLING_POTENCIA = 12        # escala fuerza de disparo (ajusta si quieres más/menos potencia)

# ------------------ Clases del juego ------------------
class Bird:
    def __init__(self, pos, radio=18, color=(255, 220, 0)):
        self.pos = pygame.Vector2(pos)
        self.vel = pygame.Vector2(0, 0)
        self.radio = radio
        self.color = color
        self.en_resortera = True
        self.vivo = True

    @property
    def rect(self):
        return pygame.Rect(int(self.pos.x - self.radio),
                           int(self.pos.y - self.radio),
                           self.radio * 2, self.radio * 2)

    def poner_en_resortera(self):
        self.pos.update(SLING_ANCLA.x, SLING_ANCLA.y)
        self.vel.update(0, 0)
        self.en_resortera = True

    def lanzar(self, velocidad):
        self.vel.update(velocidad.x, velocidad.y)
        self.en_resortera = False

    def actualizar(self, dt):
        if not self.vivo:
            return
        if not self.en_resortera:
            # física
            self.vel.y += GRAVEDAD * dt
            self.pos += self.vel * dt

            # colisión con el suelo
            if self.pos.y + self.radio > SUELO_Y:
                self.pos.y = SUELO_Y - self.radio
                if self.vel.y > 0:
                    self.vel.y *= -0.45            # rebote amortiguado
                self.vel.x *= 0.98                # fricción horizontal
                # si ya casi no se mueve, detenerlo
                if self.vel.length() < 30:
                    self.vel.update(0, 0)

            # límites laterales simples
            if self.pos.x < self.radio:
                self.pos.x = self.radio
                if self.vel.x < 0:
                    self.vel.x *= -0.5
            if self.pos.x > ANCHO - self.radio:
                self.pos.x = ANCHO - self.radio
                if self.vel.x > 0:
                    self.vel.x *= -0.5

    def dibujar(self, surf):
        pygame.draw.circle(surf, self.color, self.pos, self.radio)
        # “brillo” sencillo
        pygame.draw.circle(surf, (255, 255, 255), self.pos - pygame.Vector2(6, 6), max(2, self.radio // 5))

class Block:
    """Bloque rectangular estático (obstáculo)."""
    def __init__(self, rect, color=(160, 160, 160)):
        self.rect = pygame.Rect(rect)
        self.color = color

    def dibujar(self, surf):
        pygame.draw.rect(surf, self.color, self.rect, border_radius=4)

class Pig:
    def __init__(self, pos, radio=20, color=(110, 200, 110)):
        self.pos = pygame.Vector2(pos)
        self.radio = radio
        self.color = color
        self.vivo = True

    @property
    def rect(self):
        return pygame.Rect(int(self.pos.x - self.radio),
                           int(self.pos.y - self.radio),
                           self.radio * 2, self.radio * 2)

    def dibujar(self, surf):
        if not self.vivo: 
            return
        pygame.draw.circle(surf, self.color, self.pos, self.radio)
        # ojitos
        pygame.draw.circle(surf, (30, 60, 30), self.pos + pygame.Vector2(-6, -3), 3)
        pygame.draw.circle(surf, (30, 60, 30), self.pos + pygame.Vector2( 6, -3), 3)

# ------------------ Utilidades de colisión ------------------
def clamp(value, lo, hi):
    return lo if value < lo else hi if value > hi else value

def colision_circulo_rect(centro: pygame.Vector2, radio: float, rect: pygame.Rect):
    """Devuelve (colisiona:bool, normal:Vector2, punto_contacto:Vector2)"""
    cx, cy = centro.x, centro.y
    px = clamp(cx, rect.left, rect.right)
    py = clamp(cy, rect.top, rect.bottom)
    contacto = pygame.Vector2(px, py)
    delta = centro - contacto
    dist2 = delta.x * delta.x + delta.y * delta.y
    if dist2 <= radio * radio:
        # normal (si delta es cero, empujar hacia el lado más cercano)
        if delta.length_squared() == 0:
            # encuentra la normal hacia el borde más cercano
            left_d   = abs(cx - rect.left)
            right_d  = abs(rect.right - cx)
            top_d    = abs(cy - rect.top)
            bottom_d = abs(rect.bottom - cy)
            m = min(left_d, right_d, top_d, bottom_d)
            if m == left_d:   normal = pygame.Vector2(-1, 0)
            elif m == right_d:normal = pygame.Vector2( 1, 0)
            elif m == top_d:  normal = pygame.Vector2(0, -1)
            else:             normal = pygame.Vector2(0,  1)
        else:
            normal = delta.normalize()
        return True, normal, contacto
    return False, pygame.Vector2(), pygame.Vector2()

# ------------------ Construcción de nivel ------------------
def crear_nivel_basico():
    bloques = []
    cerdos = []

    # plataforma base
    base = Block((820, SUELO_Y - 20, 260, 20), color=(150, 120, 90))
    bloques.append(base)

    # torre sencilla de bloques
    x0 = 900
    w, h = 40, 70
    for i in range(3):
        bloques.append(Block((x0, SUELO_Y - 20 - h * (i + 1), w, h), color=(170, 170, 170)))
    for i in range(3):
        bloques.append(Block((x0 + 60, SUELO_Y - 20 - h * (i + 1), w, h), color=(170, 170, 170)))

    # techo
    bloques.append(Block((x0 - 10, SUELO_Y - 20 - h * 3 - 20, 140, 20), color=(180, 150, 120)))

    # cerditos
    cerdos.append(Pig((x0 + 30, SUELO_Y - 20 - h - 22), radio=18))
    cerdos.append(Pig((x0 + 90, SUELO_Y - 20 - h * 2 - 22), radio=18))
    cerdos.append(Pig((x0 + 30, SUELO_Y - 20 - h * 3 - 40), radio=20))

    return bloques, cerdos

# ------------------ Dibujo de resortera ------------------
def dibujar_resortera(surf, pajaro: Bird, arrastrando: bool):
    # poste/base
    pygame.draw.line(surf, (70, 40, 25), (SLING_ANCLA.x - 18, SUELO_Y), (SLING_ANCLA.x - 18, SLING_ANCLA.y + 20), 8)
    pygame.draw.line(surf, (70, 40, 25), (SLING_ANCLA.x + 18, SUELO_Y), (SLING_ANCLA.x + 18, SLING_ANCLA.y + 20), 8)

    # bandas (si está en la resortera o se está arrastrando)
    if pajaro.en_resortera or arrastrando:
        pygame.draw.line(surf, COLOR_BANDA, (SLING_ANCLA.x - 8, SLING_ANCLA.y),
                         (pajaro.pos.x - 5, pajaro.pos.y), 4)
        pygame.draw.line(surf, COLOR_BANDA, (SLING_ANCLA.x + 8, SLING_ANCLA.y),
                         (pajaro.pos.x + 5, pajaro.pos.y), 4)

# ------------------ Lógica principal ------------------
def main():
    pygame.init()
    pantalla = pygame.display.set_mode((ANCHO, ALTO))
    pygame.display.set_caption("Angry Birds — versión simple (pygame)")
    reloj = pygame.time.Clock()
    fuente = pygame.font.SysFont(None, 32)
    fuente_grande = pygame.font.SysFont(None, 60)

    # mundo
    pajaro = Bird(SLING_ANCLA)
    bloques, cerdos = crear_nivel_basico()

    arrastrando = False
    puntuacion = 0
    ganaste = False

    while True:
        dt = reloj.tick(FPS) / 1000.0

        # ---------------- Eventos ----------------
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT:
                pygame.quit(); sys.exit()
            elif ev.type == pygame.KEYDOWN:
                if ev.key == pygame.K_ESCAPE:
                    pygame.quit(); sys.exit()
                if ev.key == pygame.K_r:   # reiniciar nivel
                    pajaro = Bird(SLING_ANCLA)
                    bloques, cerdos = crear_nivel_basico()
                    puntuacion = 0
                    ganaste = False
                if ev.key == pygame.K_SPACE and ganaste:
                    pajaro = Bird(SLING_ANCLA)
                    bloques, cerdos = crear_nivel_basico()
                    puntuacion = 0
                    ganaste = False

            elif ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1:
                if pajaro.en_resortera:
                    # ¿clic dentro del pájaro?
                    if (pygame.Vector2(ev.pos) - pajaro.pos).length() <= pajaro.radio + 6:
                        arrastrando = True

            elif ev.type == pygame.MOUSEBUTTONUP and ev.button == 1:
                if arrastrando:
                    # lanzar
                    estiron = SLING_ANCLA - pajaro.pos
                    vel = estiron * SLING_POTENCIA
                    pajaro.lanzar(vel)
                    arrastrando = False

            elif ev.type == pygame.MOUSEMOTION:
                if arrastrando:
                    # restringir el arrastre a un círculo
                    mouse = pygame.Vector2(ev.pos)
                    delta = mouse - SLING_ANCLA
                    if delta.length() > SLING_MAX_ESTIRON:
                        mouse = SLING_ANCLA + delta.normalize() * SLING_MAX_ESTIRON
                    # no dejarlo bajo el suelo
                    mouse.y = min(mouse.y, SUELO_Y - pajaro.radio)
                    pajaro.pos.update(mouse.x, mouse.y)

        # ---------------- Actualización ----------------
        if pajaro.en_resortera:
            pajaro.pos.y = min(pajaro.pos.y, SUELO_Y - pajaro.radio)

        pajaro.actualizar(dt)

        # Colisión pájaro-bloques (rebote simple)
        for b in bloques:
            col, normal, contacto = colision_circulo_rect(pajaro.pos, pajaro.radio, b.rect)
            if col and not pajaro.en_resortera:
                # corregir penetración
                push = pajaro.radio - (pajaro.pos - contacto).length()
                pajaro.pos += normal * max(0, push + 0.5)
                # reflejar velocidad con amortiguación
                vn = pajaro.vel.dot(normal)
                vt = pajaro.vel - normal * vn
                pajaro.vel = vt - normal * vn * 0.45
                pajaro.vel *= 2

        # Colisión con cerdos
        for pig in cerdos:
            if not pig.vivo:
                continue
            delta = pajaro.pos - pig.pos
            dist = delta.length()
            if dist <= pajaro.radio + pig.radio:
                # determinar daño por velocidad del pájaro
                impacto = pajaro.vel.length()
                if impacto > 260:
                    pig.vivo = False
                    puntuacion += 100
                    # pequeño rebote del pájaro
                    if dist != 0:
                        normal = delta.normalize()
                    else:
                        normal = pygame.Vector2(1, 0)
                    pajaro.vel = pajaro.vel.reflect(normal) * 0.6
                else:
                    # solo rebotar
                    if dist != 0:
                        normal = delta.normalize()
                        pajaro.vel = pajaro.vel.reflect(normal) * 1
                        # separarlos
                        overlap = pajaro.radio + pig.radio - dist
                        pajaro.pos += normal * (overlap + 0.5)

        if all(not p.vivo for p in cerdos):
            ganaste = True

        # ---------------- Dibujo ----------------
        pantalla.fill(COLOR_CIELO)

        # suelo
        pygame.draw.rect(pantalla, COLOR_SUELO, (0, SUELO_Y, ANCHO, ALTO - SUELO_Y))

        # resortera
        dibujar_resortera(pantalla, pajaro, arrastrando)

        # bloques y cerdos
        for b in bloques:
            b.dibujar(pantalla)
        for p in cerdos:
            p.dibujar(pantalla)

        # pájaro
        pajaro.dibujar(pantalla)

        # UI
        texto = f"Puntuación: {puntuacion}   (R = reiniciar, ESC = salir)"
        surf = fuente.render(texto, True, (20, 40, 60))
        pantalla.blit(surf, (16, 16))

        if ganaste:
            t = fuente_grande.render("¡Nivel completado!  (ESPACIO para reiniciar)", True, (20, 80, 20))
            pantalla.blit(t, (ANCHO // 2 - t.get_width() // 2, 90))

        pygame.display.flip()

if __name__ == "__main__":
    main()