# Blender (bpy 5.3): "ไก่ชนน้อย", a chibi Thai gamecock chick: round body in red-brown with a gold-orange neck ruff,
# a red comb and wattles, a dark green-black sickle tail, strong yellow legs. An original design. Parts hang on named
# pivots (root, body, head, wing.L, wing.R, tail, leg.L, leg.R) for anim.mjs; it faces Blender -Y (+Z in the game).
import bpy, math, os

OUT = os.environ.get("OUT", os.getcwd())
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.collection

def mat(name, base, metal=0.0, rough=0.55):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    return m
BODY = mat("body", (0.52, 0.16, 0.07), 0, 0.6)       # deep red-brown
RUFF = mat("ruff", (0.92, 0.55, 0.14), 0, 0.5)       # gold-orange hackles
HEAD = mat("head", (0.8, 0.3, 0.1), 0, 0.55)        # red-orange face
COMB = mat("comb", (0.85, 0.08, 0.08), 0, 0.45)
TAIL = mat("tail", (0.03, 0.1, 0.07), 0, 0.42)      # glossy green-black
BEAK = mat("beak", (0.95, 0.78, 0.32), 0, 0.4)
LEG = mat("leg", (0.93, 0.74, 0.25), 0, 0.5)
EYE = mat("eye", (0.98, 0.62, 0.12), 0, 0.15)
PUPIL = mat("pupil", (0.01, 0.01, 0.02), 0, 0.1)
SHINE = mat("shine", (1, 1, 1), 0, 0.3)
PINK = mat("pink", (0.95, 0.5, 0.5), 0, 0.6)

def pivot(name, at, parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.1; col.objects.link(e); e.location = at
    if parent: e.parent = parent; e.matrix_parent_inverse = parent.matrix_world.inverted()
    bpy.context.view_layer.update(); return e

def hang(o, parent):
    bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o

def ball(name, at, rad, m, parent, rot=(0, 0, 0), seg=(14, 9)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=1, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = rad; bpy.ops.object.shade_smooth(); o.data.materials.append(m); return hang(o, parent)

def cone(name, at, r, depth, m, parent, rot=(0, 0, 0), sc=(1, 1, 1), seg=10):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=0.0, depth=depth, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = sc; bpy.ops.object.shade_smooth(); o.data.materials.append(m); return hang(o, parent)

def tube(name, pts, m, parent, res=8):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 1.0; cu.bevel_resolution = 2; cu.resolution_u = res; cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, (x, y, z, r) in zip(sp.bezier_points, pts): bp.co = (x, y, z); bp.radius = r; bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu); col.objects.link(o); bpy.context.view_layer.objects.active = o
    for x in bpy.context.view_layer.objects: x.select_set(False)
    o.select_set(True); bpy.ops.object.convert(target="MESH"); o = bpy.context.object; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return hang(o, parent)

root = pivot("root", (0, 0, 0))
body = pivot("body", (0, 0, 0.32), root)
head = pivot("head", (0, -0.12, 0.68), body)
wingL = pivot("wing.L", (0.22, 0.0, 0.48), body)
wingR = pivot("wing.R", (-0.22, 0.0, 0.48), body)
tail = pivot("tail", (0, 0.24, 0.5), body)
legL = pivot("leg.L", (0.09, 0.0, 0.2), root)
legR = pivot("leg.R", (-0.09, 0.0, 0.2), root)

# body: an upright egg, chest puffed forward, with a ruff of gold hackles at the neck
ball("torso", (0, 0.0, 0.42), (0.25, 0.27, 0.26), BODY, body)
ball("breast", (0, -0.13, 0.4), (0.19, 0.14, 0.2), BODY, body)
# hackles: a smooth gold cape over the shoulders, with rounded tips hanging over the back and sides
ball("cape", (0, -0.02, 0.55), (0.235, 0.235, 0.11), RUFF, body)
for k in range(7):
    a = math.pi * (0.25 + k * 0.25)  # from one shoulder round the back to the other
    ball(f"hackle{k}", (math.cos(a) * 0.2, 0.0 + math.sin(a) * 0.19, 0.47), (0.06, 0.06, 0.075), RUFF, body, seg=(10, 7))
ball("neck", (0, -0.08, 0.6), (0.15, 0.14, 0.13), RUFF, body)
# head: round, a red comb of three lobes, wattles under a short yellow beak, big amber eyes
ball("skull", (0, -0.13, 0.78), (0.16, 0.15, 0.15), HEAD, head)
for k, (y, z, r) in enumerate(((-0.2, 0.93, 0.05), (-0.13, 0.96, 0.058), (-0.06, 0.94, 0.05))): ball(f"comb{k}", (0, y, z), (0.025, r, r), COMB, head, seg=(10, 7))
cone("beak", (0, -0.31, 0.77), 0.045, 0.1, BEAK, head, rot=(math.pi / 2 + 0.25, 0, 0), sc=(1, 0.8, 1))
for s in (1, -1): ball(f"wattle{s}", (s * 0.025, -0.27, 0.69), (0.025, 0.02, 0.045), COMB, head, seg=(8, 6))
for s in (1, -1):
    ball(f"eye{s}", (s * 0.085, -0.25, 0.81), (0.04, 0.025, 0.045), EYE, head, seg=(12, 8))
    ball(f"pupil{s}", (s * 0.088, -0.27, 0.81), (0.019, 0.01, 0.026), PUPIL, head, seg=(8, 6))
    ball(f"glint{s}", (s * 0.075, -0.275, 0.825), (0.01, 0.006, 0.01), SHINE, head, seg=(8, 5))
    ball(f"cheek{s}", (s * 0.12, -0.2, 0.74), (0.035, 0.012, 0.022), PINK, head, seg=(8, 5))
# wings: folded, a little darker at the tips, each on its own pivot so they can flap
for w, s in ((wingL, 1), (wingR, -1)):
    ball(f"wing{s}", (s * 0.24, 0.04, 0.44), (0.07, 0.19, 0.15), BODY, w, rot=(0.25, 0, 0))
    ball(f"wingtip{s}", (s * 0.25, 0.17, 0.36), (0.05, 0.09, 0.07), TAIL, w, rot=(0.4, 0, 0))
# the sickle tail: long arched feathers sweeping up and back
for k, (dx, h, r) in enumerate(((0, 0.42, 0.04), (0.07, 0.36, 0.035), (-0.07, 0.36, 0.035), (0.13, 0.28, 0.03), (-0.13, 0.28, 0.03))):
    tube(f"sickle{k}", [(dx * 0.4, 0.22, 0.5, r), (dx * 0.8, 0.36, 0.5 + h * 0.6, r * 0.9), (dx, 0.5, 0.5 + h * 0.75, r * 0.7), (dx * 1.1, 0.62, 0.5 + h * 0.4, r * 0.3)], TAIL, tail)
# legs: sturdy yellow shanks and three-toed feet, each leg on its own pivot
for lg, s in ((legL, 1), (legR, -1)):
    tube(f"shank{s}", [(s * 0.09, -0.01, 0.2, 0.03), (s * 0.095, -0.02, 0.1, 0.028), (s * 0.1, -0.03, 0.03, 0.026)], LEG, lg)
    for k, a in enumerate((-0.45, 0, 0.45)): tube(f"toe{s}{k}", [(s * 0.1, -0.03, 0.025, 0.018), (s * 0.1 + math.sin(a) * 0.09, -0.03 - math.cos(a) * 0.1, 0.015, 0.014)], LEG, lg)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "kai_raw.glb"), export_format="GLB", export_yup=True, export_apply=True, export_texcoords=False, export_animations=False)
print("faces", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"))
