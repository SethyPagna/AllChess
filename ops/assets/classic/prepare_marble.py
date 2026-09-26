"""Adapt Riley Queen's CC0 Poly Haven chess set, preserving its UV/PBR work.

blender -b -t 4 --python ops/assets/classic/prepare_marble.py -- SOURCE_GLTF
Sources and license: https://polyhaven.com/a/chess_set
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
OUT = ROOT / 'public/assets/classic'
SPRITES = OUT / 'marble'
SPRITES.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
pieces = []
scale = .068 / bpy.data.objects['piece_king_white'].dimensions.z
for side, original in [('light', 'white'), ('dark', 'black')]:
    for code in ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn']:
        obj = bpy.data.objects[f'piece_{code}_{original}' + ('' if code in ['king', 'queen'] else '_01')]
        # Bake the source transform and center each playable piece on its foot.
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        low = Vector(tuple(min(v.co[i] for v in obj.data.vertices) for i in range(3)))
        high = Vector(tuple(max(v.co[i] for v in obj.data.vertices) for i in range(3)))
        center = Vector(((low.x + high.x)/2, (low.y + high.y)/2, low.z))
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - center) * scale
        # Both masters face the same direction; the board handles ownership rotation.
        if original == 'black' and code == 'knight':
            obj.data.transform(Matrix.Rotation(math.pi, 4, 'Z'))
        obj.name = f'{side}_{code}'
        obj.data.name = f'{side}_{code}_uv_mesh'
        pieces.append(obj)
for obj in list(bpy.data.objects):
    if obj not in pieces:
        bpy.data.objects.remove(obj, do_unlink=True)
for mat in bpy.data.materials:
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                node.image.pack()
                # Keep the artist's base colour, normal and packed ORM maps.
for obj in pieces:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'marble.glb'), export_format='GLB', use_selection=True,
                         export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=92)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.world = bpy.data.worlds.new('Studio ambient')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.7,.76,.85,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .3
def area(name, location, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector((0,0,.025))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox',(-.13,-.18,.19),2.4,.15,(1,.93,.82))
area('Edge strip',(.09,.09,.14),3,.10,(.82,.9,1))
area('Front fill',(.1,-.16,.05),.5,.12,(1,1,1))
data=bpy.data.cameras.new('Orthographic piece camera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera)
scene.camera=camera;data.type='ORTHO';data.ortho_scale=.079
camera.location=(.025,-.22,.082)
camera.rotation_euler=(Vector((0,0,.033))-camera.location).to_track_quat('-Z','Y').to_euler()
for obj in pieces:
    obj.hide_render=True
for obj in pieces:
    if '--knights-only' in sys.argv and 'knight' not in obj.name:
        continue
    obj.hide_render=False
    obj.rotation_mode='XYZ'
    if 'knight' in obj.name:
        obj.rotation_euler.z = -math.pi/2
    scene.render.filepath=str(SPRITES/f'{obj.name}.png')
    bpy.ops.render.render(write_still=True)
    obj.rotation_euler.z = 0
    obj.hide_render=True
for i,obj in enumerate(pieces):
    obj.hide_render=False;obj.location=((i%6-2.5)*.047, (.028 if i>=6 else -.028), 0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'ops/assets/classic/marble.blend'))
print('MARBLE_ASSETS_COMPLETE', len(pieces))
