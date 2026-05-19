import sys
import math
import random
import pygame

# =========================
# Configuración del mundo
# =========================
ANCHO, ALTO = 1200, 680
FPS = 60
GRAVEDAD = 1300.0
SUELO_Y = ALTO - 60

COLOR_CIELO = (200, 230, 255)
COLOR_SUELO = (120, 85, 60)
COLOR_BANDA = (90, 50, 30)

# Resortera
SLING_ANCLA = pygame.Vector2(180, SUELO_Y - 100)
SLING_MAX_ESTIRON = 160
SLING_POTENCIA = 12.0  # súbela si quieres aún más alcance

# Materiales: (color, masa, vida, restitución, umbral_vel, daño_escala)
MATERIALES = {
    "madera": ((181, 140, 99), 1.0, 60.0, 0.25, 220.0, 0.20),
    "piedra": ((160, 160, 160), 2.0, 120.0, 0.15, 300.0, 0.15),
    "vidrio": ((180, 220, 255), 0.6, 30.0, 0.10, 160.0, 0.35),
}

# =========================
# Utilidades de colisión
# =========================
def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v

def aabb_overlap(rectA: pygame.Rect, rectB: pygame.Rect):
    """Devuelve (colisiona, normal, penetration) eligiendo el eje de mínima penetración."""
    if not rectA.colliderect(rectB):
        return False, pygame.Vector2(), 0.0
    dx1 = rectB.right - rectA.left
    dx2 = rectA.right - rectB.left
    overlap_x = dx1 if dx1 < dx2 else -dx2
    dy1 = rectB.bottom - rectA.top
    dy2 = rectA.bottom - rectB.top
    overlap_y = dy1 if dy1 < dy2 else -dy2

    if abs(overlap_x) < abs(overlap_y):
        normal = pygame.Vector2(1, 0) if overlap_x > 0 else pygame.Vector2(-1, 0)
        return True, normal, abs(overlap_x)
    else:
        normal = pygame.Vector2(0, 1) if overlap_y > 0 else pygame.Vector2(0, -1)
        return True, normal, abs(overlap_y)

def colision_circulo_rect(centro: pygame.Vector2, radio: float, rect: pygame.Rect):
    """(colisiona, normal, penetration, punto) aproximado para círculo vs AABB."""
    cx, cy = centro.x, centro.y
    px = clamp(cx, rect.left, rect.right)
    py = clamp(cy, rect.top, rect.bottom)
    contacto = pygame.Vector2(px, py)
    delta = centro - contacto
    dist2 = delta.x * delta.x + delta.y * delta.y
    if dist2 <= radio * radio:
        if delta.length_squared() == 0:
            # Normal hacia el lado más cercano para evitar NaNs
            left_d = abs(cx - rect.left); right_d = abs(rect.right - cx)
            top_d = abs(cy - rect.top); bottom_d = abs(rect.bottom - cy)
            m = min(left_d, right_d, top_d, bottom_d)
            if m == left_d:   normal = pygame.Vector2(-1, 0)
            elif m == right_d:normal = pygame.Vector2( 1, 0)
            elif m == top_d:  normal = pygame.Vector2(0, -1)
            else:             normal = pygame.Vector2(0,  1)
        else:
            normal = delta.normalize()
        penetration = max(0.0, radio - math.sqrt(dist2))
        return True, normal, penetration, contacto
    return False, pygame.Vector2(), 0.0, contacto

def colision_circulo_circulo(posA: pygame.Vector2, rA: float, velA: pygame.Vector2,
                             posB: pygame.Vector2, rB: float, velB: pygame.Vector2):
    """Resuelve colisión círculo-círculo con restitución promedio. Devuelve normal y penetración."""
    delta = posA - posB
    dist = delta.length()
    min_dist = rA + rB
    if dist == 0:
        return True, pygame.Vector2(1, 0), min_dist
    if dist < min_dist:
        return True, delta / dist, (min_dist - dist)
    return False, pygame.Vector2(), 0.0

# =========================
# Entidades
# =========================
class Bird:
    def __init__(self, pos, radio=18, color=(255, 220, 0)):
        self.pos = pygame.Vector2(pos)
        self.vel = pygame.Vector2(0, 0)
        self.radio = radio
        self.color = color
        self.en_resortera = True

    def rect(self):
        return pygame.Rect(int(self.pos.x - self.radio), int(self.pos.y - self.radio),
                           self.radio * 2, self.radio * 2)

    def poner_en_resortera(self):
        self.pos.update(SLING_ANCLA.x, SLING_ANCLA.y)
        self.vel.update(0, 0)
        self.en_resortera = True

    def lanzar(self, vel: pygame.Vector2):
        self.vel.update(vel.x, vel.y)
        self.en_resortera = False

    def actualizar(self, dt):
        if self.en_resortera:
            return
        self.vel.y += GRAVEDAD * dt
        self.pos += self.vel * dt

        # Suelo
        if self.pos.y + self.radio > SUELO_Y:
            self.pos.y = SUELO_Y - self.radio
            if self.vel.y > 0:
                self.vel.y *= -0.45
            self.vel.x *= 0.98
            if self.vel.length() < 25:
                self.vel.update(0, 0)
        # Paredes
        if self.pos.x < self.radio:
            self.pos.x = self.radio; self.vel.x *= -0.5
        if self.pos.x > ANCHO - self.radio:
            self.pos.x = ANCHO - self.radio; self.vel.x *= -0.5

    def dibujar(self, surf):
        pygame.draw.circle(surf, self.color, self.pos, self.radio)
        pygame.draw.circle(surf, (255, 255, 255), self.pos - pygame.Vector2(6, 6), max(2, self.radio // 5))

class Block:
    """Bloque dinámico, destructible (AABB sin rotación)."""
    def __init__(self, x, y, w, h, material="madera"):
        col, masa, vida, rest, umbral, escala = MATERIALES[material]
        self.pos = pygame.Vector2(x, y)   # centro
        self.w, self.h = w, h
        self.vel = pygame.Vector2(0, 0)
        self.material = material
        self.color = col
        self.masa = masa
        self.hp_max = vida
        self.hp = vida
        self.rest = rest
        self.umbral_vel = umbral
        self.escala_danho = escala
        self.vivo = True

    def rect(self):
        return pygame.Rect(int(self.pos.x - self.w/2), int(self.pos.y - self.h/2), int(self.w), int(self.h))

    def actualizar(self, dt):
        if not self.vivo:
            return
        # gravedad
        self.vel.y += GRAVEDAD * dt
        self.pos += self.vel * dt

        # suelo
        r = self.rect()
        if r.bottom > SUELO_Y:
            pen = r.bottom - SUELO_Y
            self.pos.y -= pen
            # rebote vertical amortiguado + fricción
            if self.vel.y > 0:
                self.vel.y *= -self.rest
            self.vel.x *= 0.96
            # daño por golpe contra el suelo
            impacto = abs(self.vel.y)
            if impacto > self.umbral_vel * 1.1:
                self.recibir_danho((impacto - self.umbral_vel) * self.escala_danho)

        # límites X (paredes)
        r = self.rect()
        if r.left < 0:
            self.pos.x -= r.left; self.vel.x *= -self.rest
        if r.right > ANCHO:
            self.pos.x -= (r.right - ANCHO); self.vel.x *= -self.rest

        if self.hp <= 0 and self.vivo:
            self.vivo = False

    def recibir_danho(self, d):
        self.hp -= d

    def dibujar(self, surf):
        if not self.vivo: return
        r = self.rect()
        pygame.draw.rect(surf, self.color, r, border_radius=4)
        # barra de vida
        ratio = max(0, self.hp / self.hp_max)
        if ratio < 1.0:
            bw = int(r.width * ratio)
            pygame.draw.rect(surf, (220, 60, 50), (r.left, r.top - 6, r.width, 4), border_radius=2)
            pygame.draw.rect(surf, (60, 200, 80), (r.left, r.top - 6, bw, 4), border_radius=2)

class Pig:
    def __init__(self, x, y, radio=20):
        self.pos = pygame.Vector2(x, y)
        self.vel = pygame.Vector2(0, 0)
        self.radio = radio
        self.hp_max = 50.0
        self.hp = self.hp_max
        self.vivo = True

    def actualizar(self, dt):
        if not self.vivo: return
        self.vel.y += GRAVEDAD * dt
        self.pos += self.vel * dt

        # suelo
        if self.pos.y + self.radio > SUELO_Y:
            pen = self.pos.y + self.radio - SUELO_Y
            self.pos.y -= pen
            if self.vel.y > 0:
                self.vel.y *= -0.35
            self.vel.x *= 0.96
            impacto = abs(self.vel.y)
            if impacto > 180:
                self.hp -= (impacto - 180) * 0.25

        # paredes
        if self.pos.x < self.radio:
            self.pos.x = self.radio; self.vel.x *= -0.3
        if self.pos.x > ANCHO - self.radio:
            self.pos.x = ANCHO - self.radio; self.vel.x *= -0.3

        if self.hp <= 0:
            self.vivo = False

    def dibujar(self, surf):
        if not self.vivo: return
        pygame.draw.circle(surf, (110, 200, 110), self.pos, self.radio)
        pygame.draw.circle(surf, (30, 60, 30), self.pos + pygame.Vector2(-6, -3), 3)
        pygame.draw.circle(surf, (30, 60, 30), self.pos + pygame.Vector2( 6, -3), 3)
        # vida
        ratio = self.hp / self.hp_max
        pygame.draw.rect(surf, (220, 60, 50), (int(self.pos.x-20), int(self.pos.y - self.radio - 12), 40, 5), border_radius=2)
        pygame.draw.rect(surf, (60, 200, 80), (int(self.pos.x-20), int(self.pos.y - self.radio - 12), int(40*ratio), 5), border_radius=2)

# =========================
# Construcción del nivel
# =========================
def crear_torre_destructible():
    """Crea una pequeña torre con materiales mixtos."""
    bloques = []

    # Plataforma base fija (piedra robusta)
    for i in range(6):
        x = 860 + i * 44
        bloque = Block(x, SUELO_Y - 10, 40, 20, "piedra")
        bloques.append(bloque)

    # Columnas
    for nivel in range(3):
        y = SUELO_Y - 10 - 20 - (nivel * 70) - 35
        bloques.append(Block(900, y, 40, 70, "madera"))
        bloques.append(Block(900 + 60, y, 40, 70, "madera"))
        bloques.append(Block(900 + 120, y, 40, 70, "madera"))

    # Travesaños de vidrio (frágiles)
    bloques.append(Block(930, SUELO_Y - 20 - 70, 160, 16, "vidrio"))
    bloques.append(Block(930, SUELO_Y - 20 - 70*2, 160, 16, "vidrio"))

    # “techo”
    bloques.append(Block(930, SUELO_Y - 20 - 70*3 - 10, 160, 16, "madera"))
    return bloques

def crear_cerdos():
    return [
        Pig(930, SUELO_Y - 20 - 70 - 28, 18),
        Pig(930, SUELO_Y - 20 - 70*2 - 28, 18),
        Pig(930, SUELO_Y - 20 - 70*3 - 46, 20),
    ]

# =========================
# Lógica principal
# =========================
def dibujar_resortera(surf, pajaro: Bird, arrastrando: bool):
    pygame.draw.line(surf, (70, 40, 25), (SLING_ANCLA.x - 18, SUELO_Y),
                     (SLING_ANCLA.x - 18, SLING_ANCLA.y + 20), 8)
    pygame.draw.line(surf, (70, 40, 25), (SLING_ANCLA.x + 18, SUELO_Y),
                     (SLING_ANCLA.x + 18, SLING_ANCLA.y + 20), 8)
    if pajaro.en_resortera or arrastrando:
        pygame.draw.line(surf, COLOR_BANDA, (SLING_ANCLA.x - 8, SLING_ANCLA.y),
                         (pajaro.pos.x - 5, pajaro.pos.y), 4)
        pygame.draw.line(surf, COLOR_BANDA, (SLING_ANCLA.x + 8, SLING_ANCLA.y),
                         (pajaro.pos.x + 5, pajaro.pos.y), 4)

def resolver_bird_block(bird: Bird, block: Block):
    # Círculo vs AABB
    col, n, pen, _ = colision_circulo_rect(bird.pos, bird.radio, block.rect())
    if not col: return
    # Corrige penetración empujando el pájaro
    bird.pos += n * (pen + 0.5)
    # Velocidad relativa del pájaro hacia el bloque
    rel = bird.vel - block.vel
    vn = rel.dot(n)
    if vn > 0:  # alejándose
        return
    # Rebotar el pájaro y transferir impulso simple al bloque
    rest = 0.45
    bird.vel = (rel - (1 + rest) * vn * n) + block.vel
    block.vel += -n * (vn * (bird.radio * 0.02))  # empujón simple

    # Daño al bloque por impacto
    impacto = abs(vn)
    if impacto > block.umbral_vel:
        block.recibir_danho((impacto - block.umbral_vel) * block.escala_danho)

def resolver_block_block(a: Block, b: Block):
    if (not a.vivo) or (not b.vivo): return
    col, n, pen = aabb_overlap(a.rect(), b.rect())
    if not col: return
    # Separación proporcional a masas (sin rotación)
    total = a.masa + b.masa
    if total == 0: total = 1
    a.pos -= n * (pen * (b.masa / total))
    b.pos += n * (pen * (a.masa / total))

    # Velocidad relativa
    rel = a.vel - b.vel
    vn = rel.dot(n)
    if vn > 0:
        return
    # Impulso 1D con restitución promedio
    rest = (a.rest + b.rest) * 0.5
    j = -(1 + rest) * vn / (1/a.masa + 1/b.masa)
    impulse = n * j
    a.vel += impulse / a.masa
    b.vel -= impulse / b.masa

    # Daño por impacto
    impacto = abs(j)  # proxy de intensidad
    if impacto > 90:
        a.recibir_danho((impacto - 90) * a.escala_danho * 0.02)
        b.recibir_danho((impacto - 90) * b.escala_danho * 0.02)

def resolver_circle_block(circle_pos, circle_r, circle_vel, block: Block):
    col, n, pen, _ = colision_circulo_rect(circle_pos, circle_r, block.rect())
    if not col: return False, pygame.Vector2()
    # separar
    circle_pos += n * (pen + 0.3)
    # relativa
    rel = circle_vel - block.vel
    vn = rel.dot(n)
    if vn > 0:  # separándose
        return True, n
    rest = (0.35 + block.rest) * 0.5
    j = -(1 + rest) * vn / (1/1.0 + 1/block.masa)  # masa círculo ~1
    impulse = n * j
    circle_vel += impulse / 1.0
    block.vel -= impulse / block.masa

    impacto = abs(j)
    if impacto > block.umbral_vel * 0.6:
        block.recibir_danho((impacto - block.umbral_vel * 0.6) * block.escala_danho * 0.02)
    return True, n

def main():
    pygame.init()
    pantalla = pygame.display.set_mode((ANCHO, ALTO))
    pygame.display.set_caption("Angry Birds — Torre Destructible (pygame)")
    reloj = pygame.time.Clock()
    fuente = pygame.font.SysFont(None, 28)
    fuente_grande = pygame.font.SysFont(None, 52)

    pajaro = Bird(SLING_ANCLA)
    bloques = crear_torre_destructible()
    cerdos = crear_cerdos()

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
                if ev.key == pygame.K_r:
                    pajaro = Bird(SLING_ANCLA)
                    bloques = crear_torre_destructible()
                    cerdos = crear_cerdos()
                    puntuacion = 0; ganaste = False
            elif ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 1:
                if pajaro.en_resortera:
                    if (pygame.Vector2(ev.pos) - pajaro.pos).length() <= pajaro.radio + 6:
                        arrastrando = True
            elif ev.type == pygame.MOUSEBUTTONUP and ev.button == 1:
                if arrastrando:
                    estiron = SLING_ANCLA - pajaro.pos
                    vel = estiron * SLING_POTENCIA
                    pajaro.lanzar(vel)
                    arrastrando = False
            elif ev.type == pygame.MOUSEMOTION and arrastrando:
                mouse = pygame.Vector2(ev.pos)
                vec = mouse - SLING_ANCLA
                if vec.length() > SLING_MAX_ESTIRON:
                    mouse = SLING_ANCLA + vec.normalize() * SLING_MAX_ESTIRON
                mouse.y = min(mouse.y, SUELO_Y - pajaro.radio)
                pajaro.pos.update(mouse.x, mouse.y)

        # ---------------- Actualización física ----------------
        if pajaro.en_resortera:
            pajaro.pos.y = min(pajaro.pos.y, SUELO_Y - pajaro.radio)
        pajaro.actualizar(dt)

        for b in bloques:
            b.actualizar(dt)
        for pig in cerdos:
            pig.actualizar(dt)

        # Bird vs Blocks
        for b in bloques:
            if not b.vivo: continue
            resolver_bird_block(pajaro, b)

        # Blocks vs Blocks
        vivos = [b for b in bloques if b.vivo]
        for i in range(len(vivos)):
            for j in range(i+1, len(vivos)):
                resolver_block_block(vivos[i], vivos[j])

        # Pigs vs suelo y blocks (ya actualizados; resolvemos contra bloques)
        for pig in cerdos:
            if not pig.vivo: continue
            for b in vivos:
                hit, n = resolver_circle_block(pig.pos, pig.radio, pig.vel, b)
                if hit:
                    # daño al cerdo por choque fuerte
                    impacto = abs((pig.vel - b.vel).dot(n))
                    if impacto > 190:
                        pig.hp -= (impacto - 190) * 0.20
                        if pig.hp <= 0:
                            pig.vivo = False
                            puntuacion += 100

        # Bird vs Pig
        for pig in cerdos:
            if not pig.vivo: continue
            ok, n, pen = colision_circulo_circulo(pajaro.pos, pajaro.radio, pajaro.vel,
                                                  pig.pos, pig.radio, pig.vel)
            if ok:
                # separar
                pajaro.pos += n * (pen*0.6)
                pig.pos   -= n * (pen*0.4)
                # rebotes simples
                rel = pajaro.vel - pig.vel
                vn = rel.dot(n)
                if vn < 0:
                    rest = 0.45
                    j = -(1 + rest) * vn / (1/1.0 + 1/1.0)
                    impulse = n * j
                    pajaro.vel += impulse / 1.0
                    pig.vel    -= impulse / 1.0
                # daño
                impacto = abs((pajaro.vel - pig.vel).dot(n))
                if impacto > 200:
                    pig.hp -= (impacto - 200) * 0.25
                    if pig.hp <= 0:
                        pig.vivo = False
                        puntuacion += 150

        # Quitar bloques destruidos (dejar los muertos para que no colisionen)
        bloques = [b for b in bloques if b.vivo]

        if bloques and all(not p.vivo for p in cerdos):
            ganaste = True

        # ---------------- Dibujo ----------------
        pantalla.fill(COLOR_CIELO)
        pygame.draw.rect(pantalla, COLOR_SUELO, (0, SUELO_Y, ANCHO, ALTO - SUELO_Y))

        dibujar_resortera(pantalla, pajaro, arrastrando)

        for b in bloques:
            b.dibujar(pantalla)
        for pig in cerdos:
            pig.dibujar(pantalla)

        pajaro.dibujar(pantalla)

        # HUD
        txt = f"Bloques: {len(bloques)}   Cerdos vivos: {sum(1 for p in cerdos if p.vivo)}   Puntos: {puntuacion}   (R=reiniciar, ESC=salir)"
        pantalla.blit(fuente.render(txt, True, (20,40,60)), (16, 16))

        if ganaste:
            s = fuente_grande.render("¡Nivel completado! (R para reiniciar)", True, (25, 90, 25))
            pantalla.blit(s, (ANCHO//2 - s.get_width()//2, 90))

        pygame.display.flip()

if __name__ == "__main__":
    main()