# Blender (bpy 5.3): "ลูกพญานาค", a chibi naga hatchling coiled on the table with its head raised: jade scales, a gold belly and crest.
# An original design. Parts hang on named pivots (root, coil, neck, head, crest, tail) for anim.mjs; it faces Blender -Y (+Z in the game).
import bpy, math, os
from mathutils import Vector

OUT = os.environ.get("OUT", os.getcwd())
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.collection

def mat(name, base, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    return m
JADE = mat("jade", (0.05, 0.38, 0.28), 0, 0.4)
BELLY = mat("belly", (0.95, 0.80, 0.42), 0, 0.5)
GOLD = mat("gold", (0.93, 0.68, 0.26), 1, 0.3)
EYE = mat("eye", (0.02, 0.015, 0.03), 0, 0.12)
SHINE = mat("shine", (1, 1, 1), 0, 0.3)
PINK = mat("pink", (0.95, 0.55, 0.62), 0, 0.6)
RUBY = mat("ruby", (0.75, 0.04, 0.08), 0, 0.2)

def pivot(name, at, parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.1; col.objects.link(e); e.location = at
    if parent: e.parent = parent; e.matrix_parent_inverse = parent.matrix_world.inverted()
    bpy.context.view_layer.update(); return e

def hang(o, parent):
    bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o

def ball(name, at, rad, m, parent, rot=(0, 0, 0), seg=(14, 9)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=1, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = rad; bpy.ops.object.shade_smooth(); o.data.materials.append(m); return hang(o, parent)

def tube(name, pts, m, parent, res=10):
    """a smooth tube through (x, y, z, radius) points: a Bezier curve with a round bevel, turned into a mesh"""
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 1.0; cu.bevel_resolution = 3; cu.resolution_u = res; cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, (x, y, z, r) in zip(sp.bezier_points, pts): bp.co = (x, y, z); bp.radius = r; bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu); col.objects.link(o); bpy.context.view_layer.objects.active = o
    for x in bpy.context.view_layer.objects: x.select_set(False)
    o.select_set(True); bpy.ops.object.convert(target="MESH"); o = bpy.context.object; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return hang(o, parent)

root = pivot("root", (0, 0, 0))
coil = pivot("coil", (0, 0, 0.0), root)
tail = pivot("tail", (0.30, 0.05, 0.08), coil)
neck = pivot("neck", (0.0, -0.18, 0.42), coil)
head = pivot("head", (0.0, -0.30, 0.86), neck)
crest = pivot("crest", (0.0, -0.26, 1.08), head)

# the coil: one and a half turns rising toward the back, from the tail tip outside to the neck at the front
pts = []
for k in range(15):
    t = k / 14; a = -0.4 + t * 2.6 * math.pi; r = 0.36 - 0.12 * t
    pts.append((math.cos(a) * r, math.sin(a) * r * 0.9, 0.08 + 0.26 * t, 0.025 + 0.12 * min(1, t * 2.5)))
pts[-1] = (0.0, -0.16, 0.38, 0.125)
tube("coil_body", pts, JADE, coil)
# a gold band down the belly side of the coil, slightly inside it
tube("coil_belly", [(x * 0.97, y * 0.97, z - 0.03, r * 0.8) for (x, y, z, r) in pts[2:]], BELLY, coil)
# the neck rising in an S to the head
neck_pts = [(0.0, -0.16, 0.38, 0.12), (0.0, -0.22, 0.56, 0.11), (0.0, -0.30, 0.70, 0.105), (0.0, -0.30, 0.86, 0.10)]
tube("neck_body", neck_pts, JADE, neck)
tube("neck_belly", [(x, y - 0.06, z, r * 0.62) for (x, y, z, r) in neck_pts], BELLY, neck)
# head: round with a short snout, big glinting eyes, pink cheeks, two tiny horns
ball("skull", (0, -0.34, 0.97), (0.2, 0.2, 0.18), JADE, head)
ball("snout", (0, -0.5, 0.93), (0.13, 0.11, 0.09), JADE, head)
ball("chin", (0, -0.48, 0.88), (0.1, 0.09, 0.05), BELLY, head)
for s in (1, -1):
    ball(f"eye{s}", (s * 0.105, -0.5, 1.02), (0.05, 0.035, 0.058), EYE, head, seg=(12, 8))
    ball(f"glint{s}", (s * 0.09, -0.53, 1.045), (0.016, 0.009, 0.016), SHINE, head, seg=(8, 5))
    ball(f"cheek{s}", (s * 0.15, -0.5, 0.92), (0.045, 0.018, 0.03), PINK, head, seg=(10, 6))
    ball(f"nostril{s}", (s * 0.04, -0.6, 0.95), (0.012, 0.008, 0.01), EYE, head, seg=(6, 4))
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.035, radius2=0.0, depth=0.12, location=(s * 0.11, -0.3, 1.13), rotation=(-0.35, s * 0.35, 0))
    o = bpy.context.object; o.name = f"horn{s}"; bpy.ops.object.shade_smooth(); o.data.materials.append(GOLD); hang(o, head)
# the crest (หงอน): five gold flames fanning back over the head, a ruby at its foot
for k, a in enumerate([-1.0, -0.5, 0, 0.5, 1.0]):
    h = 0.34 - abs(a) * 0.1
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.065, radius2=0.0, depth=h, location=(math.sin(a) * 0.11, -0.22 + abs(a) * 0.03, 1.11 + h * 0.38), rotation=(0.75, a * 0.6, 0))
    o = bpy.context.object; o.name = f"flame{k}"; o.scale = (1, 0.45, 1); bpy.ops.object.shade_smooth(); o.data.materials.append(GOLD); hang(o, crest)
ball("ruby", (0, -0.4, 1.12), (0.035, 0.02, 0.035), RUBY, crest, seg=(8, 6))
# the tail tip curls up a little and ends in a gold spark
ball("tail_spark", (0.33, 0.12, 0.12), (0.035, 0.035, 0.035), GOLD, tail, seg=(8, 6))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "naga_raw.glb"), export_format="GLB", export_yup=True, export_apply=True, export_texcoords=False, export_animations=False)
print("faces", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"))
