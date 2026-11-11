# Blender (bpy 5.3): "เสือน้อย", a chibi tiger cub sitting up, dressed for Muay Thai: a red mongkhon on its head and
# a red armband on its left foreleg. An original design. Parts hang on named pivots (root, body, head, ear.L, ear.R,
# tail, paw) for anim.mjs; it faces Blender -Y (+Z in the game).
import bpy, math, os

OUT = os.environ.get("OUT", os.getcwd())
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.collection

def mat(name, base, metal=0.0, rough=0.55):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    return m
ORANGE = mat("orange", (0.86, 0.38, 0.08), 0, 0.7)
WHITE = mat("white", (0.95, 0.92, 0.86), 0, 0.75)
STRIPE = mat("stripe", (0.07, 0.04, 0.03), 0, 0.7)
PINK = mat("pink", (0.95, 0.55, 0.62), 0, 0.6)
AMBER = mat("amber", (0.96, 0.72, 0.16), 0, 0.15)
PUPIL = mat("pupil", (0.01, 0.01, 0.02), 0, 0.1)
SHINE = mat("shine", (1, 1, 1), 0, 0.3)
RED = mat("red", (0.66, 0.04, 0.06), 0, 0.5)
GOLD = mat("gold", (0.93, 0.68, 0.26), 1, 0.3)

def pivot(name, at, parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.1; col.objects.link(e); e.location = at
    if parent: e.parent = parent; e.matrix_parent_inverse = parent.matrix_world.inverted()
    bpy.context.view_layer.update(); return e

def hang(o, parent):
    bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o

def ball(name, at, rad, m, parent, rot=(0, 0, 0), seg=(14, 9)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=1, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = rad; bpy.ops.object.shade_smooth(); o.data.materials.append(m); return hang(o, parent)

def ring(name, at, major, minor, m, parent, rot=(0, 0, 0), sc=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=8, major_radius=major, minor_radius=minor, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = sc; bpy.ops.object.shade_smooth(); o.data.materials.append(m); return hang(o, parent)

def tube(name, pts, m, parent, res=10):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 1.0; cu.bevel_resolution = 3; cu.resolution_u = res; cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, (x, y, z, r) in zip(sp.bezier_points, pts): bp.co = (x, y, z); bp.radius = r; bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu); col.objects.link(o); bpy.context.view_layer.objects.active = o
    for x in bpy.context.view_layer.objects: x.select_set(False)
    o.select_set(True); bpy.ops.object.convert(target="MESH"); o = bpy.context.object; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return hang(o, parent)

root = pivot("root", (0, 0, 0))
body = pivot("body", (0, 0.02, 0.05), root)
head = pivot("head", (0, -0.06, 0.64), body)
earL = pivot("ear.L", (0.18, -0.04, 1.04), head)
earR = pivot("ear.R", (-0.18, -0.04, 1.04), head)
tail = pivot("tail", (0, 0.28, 0.12), body)
paw = pivot("paw", (0.13, -0.2, 0.44), body)

# sitting body: a sturdy pear of orange with a white chest, haunches, front legs and white paws
ball("torso", (0, 0.04, 0.33), (0.29, 0.28, 0.32), ORANGE, body)
ball("chest", (0, -0.17, 0.36), (0.17, 0.08, 0.2), WHITE, body)
for s in (1, -1): ball(f"haunch{s}", (s * 0.18, 0.08, 0.16), (0.16, 0.21, 0.15), ORANGE, body)
ball("leg_r", (-0.12, -0.18, 0.2), (0.078, 0.078, 0.17), ORANGE, body)
ball("paw_r", (-0.12, -0.23, 0.04), (0.088, 0.098, 0.055), WHITE, body, seg=(10, 6))
ball("leg_l", (0.12, -0.18, 0.2), (0.078, 0.078, 0.17), ORANGE, paw)       # the left foreleg can lift to punch
ball("paw_l", (0.12, -0.23, 0.04), (0.088, 0.098, 0.055), WHITE, paw, seg=(10, 6))
ring("armband", (0.12, -0.18, 0.27), 0.08, 0.016, RED, paw)  # ประเจียด
ball("armknot", (0.12, -0.262, 0.27), (0.022, 0.016, 0.026), GOLD, paw, seg=(8, 6))
for s in (1, -1): ball(f"foot{s}", (s * 0.21, -0.04, 0.03), (0.088, 0.118, 0.05), WHITE, body, seg=(10, 6))
# stripes: thin dark strokes that hug the body's surface, from the flanks round toward the back
def on_ellipsoid(c, r, phi, z, lift=1.012):  # a point on the ellipsoid's surface at height z, angle phi round the vertical
    f = max(0.0, 1 - ((z - c[2]) / r[2]) ** 2) ** 0.5 * lift
    return (c[0] + r[0] * f * math.cos(phi), c[1] + r[1] * f * math.sin(phi), z)
def stroke(name, pts, parent, w=0.013):
    tube(name, [(x, y, z, w * (0.55 if k in (0, len(pts) - 1) else 1)) for k, (x, y, z) in enumerate(pts)], STRIPE, parent, res=8)
TC, TR = (0, 0.04, 0.33), (0.29, 0.28, 0.32)
for s in (1, -1):
    for k, z in enumerate((0.47, 0.37, 0.27, 0.17)):
        pts = [on_ellipsoid(TC, TR, a, z - 0.045 * j) for j, a in enumerate((-0.2, 0.3, 0.8))]
        stroke(f"bstripe{s}{k}", [(s * x, y, zz) for x, y, zz in pts], body, w=0.019)
for k, z in enumerate((0.5, 0.38)):
    stroke(f"backstripe{k}", [on_ellipsoid(TC, TR, a, z) for a in (math.pi / 2 - 0.42, math.pi / 2, math.pi / 2 + 0.42)], body, w=0.019)
# head: round and big, a white muzzle and cheek tufts, amber eyes with glints, a pink nose, stripes on the brow
ball("skull", (0, -0.08, 0.84), (0.29, 0.26, 0.25), ORANGE, head)
ball("muzzle", (0, -0.27, 0.77), (0.14, 0.08, 0.09), WHITE, head)
for s in (1, -1): ball(f"tuft{s}", (s * 0.2, -0.19, 0.75), (0.1, 0.07, 0.075), WHITE, head)
ball("nose", (0, -0.345, 0.81), (0.035, 0.02, 0.025), PINK, head, seg=(8, 6))
for s in (1, -1):
    ball(f"eye{s}", (s * 0.105, -0.29, 0.88), (0.052, 0.03, 0.058), AMBER, head, seg=(12, 8))
    ball(f"pupil{s}", (s * 0.105, -0.316, 0.875), (0.024, 0.01, 0.04), PUPIL, head, seg=(8, 6))
    ball(f"glint{s}", (s * 0.09, -0.326, 0.9), (0.014, 0.008, 0.014), SHINE, head, seg=(8, 5))
HC, HR = (0, -0.08, 0.84), (0.29, 0.26, 0.25)
def on_head_front(x, z, lift=1.012):  # the point on the face at this x and height
    f = max(0.0, 1 - (x / HR[0]) ** 2 - ((z - HC[2]) / HR[2]) ** 2) ** 0.5
    return (x * lift, HC[1] - HR[1] * f * lift, HC[2] + (z - HC[2]) * lift)
def on_head_side(s, y, z, lift=1.012):  # the point on the side of the head at this depth and height
    f = max(0.0, 1 - ((y - HC[1]) / HR[1]) ** 2 - ((z - HC[2]) / HR[2]) ** 2) ** 0.5
    return (s * HR[0] * f * lift, y, z)
for s in (1, -1):  # two short whisker-stripes on each cheek, above the tufts
    for k, z in enumerate((0.88, 0.83)): stroke(f"cheekstripe{s}{k}", [on_head_side(s, y, z + dz) for y, dz in ((-0.14, 0), (-0.06, 0.01), (0.02, 0.02))], head, w=0.011)
for k, (x0, x1) in enumerate(((0, 0), (0.07, 0.095), (-0.07, -0.095))):  # three strokes on the brow, above the mongkhon
    stroke(f"browstripe{k}", [on_head_front(x0 + (x1 - x0) * j / 2, z) for j, z in enumerate((0.99, 1.025, 1.06))], head, w=0.012)
# ears: round, white inside, each on its own pivot so they can twitch
for e, s in ((earL, 1), (earR, -1)):
    ball(f"ear{s}", (s * 0.17, -0.04, 1.04), (0.085, 0.045, 0.085), ORANGE, e)
    ball(f"earin{s}", (s * 0.17, -0.075, 1.03), (0.052, 0.02, 0.052), WHITE, e)
# the mongkhon: a red ring round the head with gold bands, its tail hanging behind
ring("mongkhon", (0, -0.07, 0.95), 1.0, 0.03, RED, head, sc=(0.283, 0.255, 1))
for s in (1, -1): ball(f"mband{s}", (s * 0.2, -0.24, 0.95), (0.03, 0.03, 0.035), GOLD, head, seg=(8, 6))
tube("mtail", [(0, 0.18, 0.95, 0.022), (0, 0.27, 0.9, 0.02), (0, 0.31, 0.8, 0.016)], RED, head)
# the tail curls round from behind and up, ringed dark, with a dark tip
tube("tail_rope", [(0, 0.28, 0.12, 0.055), (0.16, 0.38, 0.17, 0.05), (0.31, 0.3, 0.33, 0.045), (0.31, 0.14, 0.52, 0.042)], ORANGE, tail)
for k, (x, y, z) in enumerate(((0.12, 0.37, 0.15), (0.27, 0.35, 0.26), (0.32, 0.22, 0.42))):
    ball(f"tailring{k}", (x, y, z), (0.058, 0.058, 0.022), STRIPE, tail, rot=(0.8 + k * 0.3, 0.3, 0), seg=(10, 6))
ball("tailtip", (0.31, 0.13, 0.55), (0.05, 0.05, 0.05), STRIPE, tail, seg=(10, 6))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "suea_raw.glb"), export_format="GLB", export_yup=True, export_apply=True, export_texcoords=False, export_animations=False)
print("faces", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"))
