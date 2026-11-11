# Blender (bpy 5.3): the props round the play mat, exported as GLB, and the candle light on the teak table baked into a light map.
# Coordinates: Blender X = three x, Blender Y = -three z, Blender Z = three y. The table top is at Z = -0.335.
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Matrix, Euler

OUT = os.environ.get("OUT", os.getcwd())
BAKE = os.environ.get("BAKE", "1") == "1"
SAMPLES = int(os.environ.get("SAMPLES", "96"))
random.seed(5)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"
TOP = -0.335
CANDLES = [(-4.2, -8.2), (4.2, -8.2), (-8.7, -5.4), (8.7, -5.4)]   # three (x, z) -> Blender (x, -z): the far side, beyond the mat
FLAME_Z = 1.66                                                   # flame centre above the table top

def mat(name, base, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m

BRASS = mat("brass", (0.80, 0.56, 0.24), 1.0, 0.3)
WAX = mat("wax", (0.88, 0.82, 0.68), 0.0, 0.55)
WICK = mat("wick", (0.03, 0.02, 0.02), 0.0, 0.9)
JAS = mat("jasmine", (0.93, 0.92, 0.86), 0.0, 0.6)
MARI = mat("marigold", (0.96, 0.40, 0.02), 0.0, 0.75)
GOLDEN = mat("marigold_light", (0.99, 0.62, 0.06), 0.0, 0.75)
ROSE = mat("rose", (0.50, 0.015, 0.03), 0.0, 0.6)
WATER = mat("water", (0.015, 0.02, 0.02), 0.0, 0.04)
RIBBON = mat("ribbon", (0.62, 0.04, 0.07), 0.0, 0.45)

def link(name, bm, m):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); return ob

def lathe(name, prof, m, seg=40, at=(0, 0, 0)):
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in prof]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=seg, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = link(name, bm, m); ob.location = at; return ob

def blobs(name, items, m, us=8, vs=6):
    """one mesh of many small ellipsoids: items are (centre, radii, rotation Euler)"""
    bm = bmesh.new()
    for c, rad, rot in items:
        g = bmesh.ops.create_uvsphere(bm, u_segments=us, v_segments=vs, radius=1.0)
        M = Matrix.Translation(Vector(c)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*rad, 1))
        bmesh.ops.transform(bm, matrix=M, verts=g["verts"])
    return link(name, bm, m)

# ---- brass candlesticks (เชิงเทียน) with a melted candle each ----
STAND = [(0, 0), (0.40, 0), (0.42, 0.015), (0.42, 0.04), (0.38, 0.06), (0.30, 0.075), (0.26, 0.10), (0.27, 0.125), (0.24, 0.15), (0.16, 0.17),
         (0.10, 0.20), (0.075, 0.26), (0.07, 0.34), (0.10, 0.39), (0.125, 0.43), (0.10, 0.47), (0.065, 0.51), (0.055, 0.62), (0.055, 0.74),
         (0.085, 0.78), (0.10, 0.81), (0.085, 0.84), (0.06, 0.87), (0.06, 0.92), (0.20, 0.95), (0.27, 0.975), (0.285, 0.995), (0.27, 1.01),
         (0.12, 1.01), (0.115, 1.05), (0.12, 1.10), (0.13, 1.12), (0.125, 1.13), (0.10, 1.13), (0.10, 1.06), (0, 1.06)]
CANDLE = [(0, 1.06), (0.092, 1.06), (0.092, 1.50), (0.088, 1.535), (0.07, 1.545), (0.04, 1.535), (0, 1.53)]
props = []
for k, (x, z) in enumerate(CANDLES):
    at = (x, -z, TOP)
    props.append(lathe(f"stand{k}", STAND, BRASS, 20, at))
    c = lathe(f"candle{k}", CANDLE, WAX, 14, at); props.append(c)
    drips = []
    for d in range(4):
        a = random.uniform(0, 2 * math.pi); L = random.uniform(0.05, 0.16)
        drips.append(((x + math.cos(a) * 0.088, -z + math.sin(a) * 0.088, TOP + 1.53 - L * 0.6), (0.018, 0.018, L), (0, 0, a)))
    props.append(blobs(f"drips{k}", drips, WAX, 5, 3))
    w = blobs(f"wick{k}", [((x, -z, TOP + 1.575), (0.009, 0.009, 0.045), (0.25, 0, random.uniform(0, 6)))], WICK, 4, 3); props.append(w)

# ---- a jasmine garland (พวงมาลัย) coiled on the table, roses and marigolds tied in, a tassel trailing out ----
GX, GY = -6.75, 7.35
buds, roses, golds = [], [], []
R, r = 0.48, 0.075
for i in range(40):
    t = i / 40 * 2 * math.pi
    if i % 10 == 0:                               # a rose at four points round the ring
        roses.append(((GX + math.cos(t) * R, GY + math.sin(t) * R, TOP + r + 0.01), (0.085, 0.085, 0.07), (0, 0, t))); continue
    for j in range(5):
        ph = (j / 5) * 2 * math.pi + (i % 2) * 0.6
        n = Vector((math.cos(t) * math.cos(ph), math.sin(t) * math.cos(ph), math.sin(ph)))
        if n.z < -0.35: continue                  # the underside rests on the table
        c = Vector((GX + math.cos(t) * R, GY + math.sin(t) * R, TOP + r)) + n * r
        rot = n.to_track_quat("Z", "Y").to_euler()
        buds.append((tuple(c), (0.026, 0.026, 0.06), tuple(rot)))
# the tassel (อุบะ): a short string of buds leaving the ring, a marigold at its end
for k in range(7):
    c = (GX + R + 0.12 + k * 0.1, GY - 0.25 - k * 0.07, TOP + 0.03)
    buds.append((c, (0.026, 0.026, 0.06), (math.pi / 2, 0, -0.6)))
golds.append(((GX + R + 0.9, GY - 0.8, TOP + 0.07), (0.09, 0.09, 0.075), (0, 0, 0)))
golds.append(((GX - R - 0.02, GY + 0.05, TOP + 0.085), (0.085, 0.085, 0.07), (0, 0, 0)))
props.append(blobs("garland_buds", buds, JAS, 5, 3))
props.append(blobs("garland_roses", roses, ROSE, 8, 5))
props.append(blobs("garland_marigolds", golds, MARI, 8, 5))
rib = blobs("garland_ribbon", [((GX + R + 0.08, GY - 0.16, TOP + 0.04), (0.11, 0.03, 0.012), (0, 0, -0.9)), ((GX + R + 0.14, GY - 0.08, TOP + 0.04), (0.1, 0.028, 0.012), (0, 0, 0.5))], RIBBON, 8, 4)
props.append(rib)

BX, BY = 7.0, 7.45   # the water bowl, beyond the mat on the right
# ---- marigold petals scattered at the candles' feet and round the garland ----
pets, pets2 = [], []
for (x, z) in CANDLES + [(GX, -GY), (BX, -BY)]:
    cx, cy = x, -z
    for k in range(18):
        a = random.uniform(0, 2 * math.pi); d = random.uniform(0.48, 1.25)
        c = (cx + math.cos(a) * d, cy + math.sin(a) * d, TOP + 0.006)
        (pets if random.random() < 0.65 else pets2).append((c, (0.055, 0.036, 0.006), (random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), random.uniform(0, 6.3))))
props.append(blobs("petals", pets, MARI, 5, 2))
props.append(blobs("petals_light", pets2, GOLDEN, 5, 2))

# ---- a brass water bowl (ขันน้ำ) with petals floating ----
BOWL = [(0, 0), (0.27, 0), (0.30, 0.02), (0.30, 0.04), (0.26, 0.055), (0.33, 0.10), (0.45, 0.22), (0.515, 0.34), (0.535, 0.39), (0.53, 0.41),
        (0.505, 0.41), (0.495, 0.37), (0.43, 0.25), (0.32, 0.13), (0.15, 0.085), (0, 0.08)]
props.append(lathe("bowl", BOWL, BRASS, 28, (BX, BY, TOP)))
props.append(lathe("water", [(0, 0.30), (0.468, 0.30), (0.468, 0.29), (0, 0.29)], WATER, 24, (BX, BY, TOP)))
fl = [((BX + math.cos(a) * d, BY + math.sin(a) * d, TOP + 0.305), (0.06, 0.04, 0.008), (0, 0, random.uniform(0, 6))) for a, d in [(0.4, 0.2), (2.1, 0.28), (3.6, 0.12), (4.8, 0.3), (5.6, 0.22)]]
props.append(blobs("bowl_petals", fl, MARI, 5, 2))
props.append(blobs("bowl_jasmine", [((BX + 0.05, BY - 0.08, TOP + 0.32), (0.03, 0.03, 0.065), (math.pi / 2, 0, 0.7)), ((BX - 0.1, BY + 0.12, TOP + 0.32), (0.03, 0.03, 0.065), (math.pi / 2, 0, 2.2))], JAS, 5, 3))

for o in props: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "props.glb"), use_selection=True, export_format="GLB", export_apply=True,
                          export_yup=True, export_normals=True, export_texcoords=False, export_materials="EXPORT", export_lights=False, export_cameras=False)
print("props exported", sum(len(o.data.polygons) for o in props), "faces")
for o in props: o.select_set(False)
if not BAKE: sys.exit(0)

# ---- the light map: candlelight, a soft key light from where the scene's key light is, and the shadows of the mat and the props ----
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 2, TOP)); table = bpy.context.object; table.scale = (70, 50, 1)
bpy.ops.object.transform_apply(scale=True)
tm = mat("table", (0.8, 0.8, 0.8), 0, 1.0); table.data.materials.append(tm)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.2, -0.17)); box = bpy.context.object; box.scale = (15.4, 11.6, 0.33); bpy.ops.object.transform_apply(scale=True)
box.data.materials.append(mat("lacquer", (0.08, 0.01, 0.008), 0, 0.3))
PASS = os.environ.get("PASS", "all")      # candles | key | all: separate bakes are mixed afterwards (lm8.py), so the balance can change without baking again
for k, (x, z) in enumerate(CANDLES):
    bpy.ops.object.light_add(type="POINT", location=(x, -z, TOP + FLAME_Z)); L = bpy.context.object
    L.data.energy = 0 if PASS == "key" else float(os.environ.get("CANDLE_W", "260")); L.data.color = (1.0, 0.58, 0.26); L.data.shadow_soft_size = 0.06
bpy.ops.object.light_add(type="AREA", location=(4, -7, 12)); K = bpy.context.object
K.data.energy = 0 if PASS == "candles" else float(os.environ.get("KEY_W", "900")); K.data.size = 7; K.data.color = (1.0, 0.88, 0.72)
K.rotation_euler = (Vector((0, 0.2, 0)) - Vector((4, -7, 12))).to_track_quat("-Z", "Y").to_euler()
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.05, 0.03, 0.02, 1); bg.inputs[1].default_value = 0 if PASS == "candles" else 0.25
LW, LH = int(os.environ.get("LW", "1024")), int(os.environ.get("LH", "732"))
img = bpy.data.images.new("lightmap", LW, LH, float_buffer=True)
nt = tm.node_tree; node = nt.nodes.new("ShaderNodeTexImage"); node.image = img; nt.nodes.active = node
for o in bpy.context.view_layer.objects: o.select_set(False)
table.select_set(True); bpy.context.view_layer.objects.active = table
sc.cycles.samples = SAMPLES
sc.render.bake.use_pass_direct = True; sc.render.bake.use_pass_indirect = True; sc.render.bake.use_pass_color = False
sc.render.bake.margin = 4
bpy.ops.object.bake(type="DIFFUSE")
print("baked lightmap")
import numpy as np
px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)[..., :3]
np.save(os.path.join(OUT, f"lightmap_{PASS}.npy"), px)
# report the light at a few places on the table (three x, z) to tune the light powers against the old look
def at(x, z):
    u = (x + 35) / 70; v = (-z - (-23)) / 50; return px[int(v * (img.size[1] - 1)), int(u * (img.size[0] - 1))].mean()
for x, z in [(0, 6.5), (0, 9), (9, 0), (12, 0), (0, -7.5), (0, -12), (-4.6, -7.6), (20, -10), (25, 5)]:
    print("light at", (x, z), round(float(at(x, z)), 3))
