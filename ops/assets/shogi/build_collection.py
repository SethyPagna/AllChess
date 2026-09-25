"""Original AllChess Shogi tiles. Blender 5.2; dimensions in metres.

Run: blender --background --python ops/assets/shogi/build_collection.py -- FONT.otf
Use Noto Serif CJK JP Bold from the source recorded in README.md.
Glyphs are converted to editable meshes; no system fonts are needed at runtime.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[3]
font_path = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
output = root / 'public/assets/shogi'
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
font = bpy.data.fonts.load(str(font_path))

def material(name, color, roughness=.38):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Coat Weight'].default_value = 0 if 'ink' in name else .18
    if 'ink' in name:
        shader.inputs['Specular IOR Level'].default_value = .05
        shader.inputs['Roughness'].default_value = .95
    return mat

wood = material('Boxwood tile', (.78, .52, .22))
ink = material('Sumi character ink', (.014, .009, .006), .45)
red = material('Vermilion promotion ink', (.46, .016, .008), .43)
plinth_mat = material('Gallery charcoal', (.025, .038, .034), .8)

pieces = [
    ('king', '玉', .038, .046), ('rook', '飛', .036, .044),
    ('bishop', '角', .036, .044), ('gold', '金', .034, .042),
    ('silver', '銀', .034, .042), ('knight', '桂', .032, .040),
    ('lance', '香', .031, .039), ('pawn', '歩', .030, .037)
]
promoted = {'rook':'竜', 'bishop':'馬', 'silver':'全', 'knight':'圭', 'lance':'杏', 'pawn':'と'}
body_meshes, glyph_meshes, roots = {}, {}, []

def body(parent, width, length):
    key = (width, length)
    if key not in body_meshes:
        outline = [(-width/2, -length/2), (width/2, -length/2),
                   (width*.39, length*.29), (0, length/2), (-width*.39, length*.29)]
        verts = [(x,y,0) for x,y in outline] + [(x,y,.010-y*.055) for x,y in outline]
        faces = [tuple(reversed(range(5))), tuple(range(5,10))]
        faces += [(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
        mesh = bpy.data.meshes.new('Pentagonal boxwood blank')
        mesh.from_pydata(verts, [], faces); mesh.update()
        uv = mesh.uv_layers.new(name='Wood grain UV')
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                point = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (point.x/width+.5, point.y/length+.5)
        mesh.materials.append(wood)
        body_meshes[key] = mesh
    obj = bpy.data.objects.new('Bevelled boxwood wedge', body_meshes[key])
    bpy.context.collection.objects.link(obj); obj.parent = parent
    bevel = obj.modifiers.new('Soft handled edges', 'BEVEL'); bevel.width=.0006; bevel.segments=3
    obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')

def glyph(parent, character, width, mat):
    key = (character, width)
    if key not in glyph_meshes:
        curve = bpy.data.curves.new('Editable character outline', 'FONT')
        curve.body=character; curve.font=font; curve.align_x='CENTER'; curve.align_y='CENTER'
        curve.size=width*.76; curve.extrude=.00006; curve.resolution_u=4
        obj = bpy.data.objects.new('Character mesh', curve); bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH')
        mesh=obj.data
        low_x=min(v.co.x for v in mesh.vertices); high_x=max(v.co.x for v in mesh.vertices)
        low_y=min(v.co.y for v in mesh.vertices); high_y=max(v.co.y for v in mesh.vertices)
        scale=min(width*.72/(high_x-low_x), width*.78/(high_y-low_y))
        for vertex in mesh.vertices:
            vertex.co.x=(vertex.co.x-(low_x+high_x)/2)*scale
            vertex.co.y=(vertex.co.y-(low_y+high_y)/2)*scale
        glyph_meshes[key]=mesh
        bpy.data.objects.remove(obj, do_unlink=True)
    mesh=glyph_meshes[key]
    obj=bpy.data.objects.new(f'Ink {character}', mesh); bpy.context.collection.objects.link(obj); obj.parent=parent
    # Material on the object lets a shared outline retain its front/back ink role.
    if not len(mesh.materials): mesh.materials.append(mat)
    obj.material_slots[0].link='OBJECT'; obj.material_slots[0].material=mat
    obj.rotation_euler.x=-math.atan(.055); obj.location=(0,-.001,.0104)
    return obj

for side in ['light','dark']:
    for index,(name,character,width,length) in enumerate(pieces):
        for back in [False,True] if name in promoted else [False]:
            semantic = ('promoted_' if back else '') + name
            parent=bpy.data.objects.new(f'{side}_{semantic}',None); bpy.context.collection.objects.link(parent); roots.append(parent)
            body(parent,width,length)
            letter=promoted[name] if back else '王' if name=='king' and side=='dark' else character
            glyph(parent,letter,width,red if back else ink)
            # Two fronts/reverses in each display row; semantic roots reset in-app.
            parent.location=((index-3.5)*.049, (.070 if side=='dark' else -.030)+( .045 if back else 0), 0)

# Authoring scene includes a real delivery camera, contact surface and studio lights.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,.04,-.006))
plinth=bpy.context.object; plinth.name='Collection presentation plinth'; plinth.dimensions=(.43,.21,.012)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); plinth.data.materials.append(plinth_mat)
bevel=plinth.modifiers.new('Rounded plinth','BEVEL'); bevel.width=.004; bevel.segments=3
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=1100; scene.render.resolution_y=710; scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE'; scene.render.image_settings.file_format='PNG'
if scene.world is None: scene.world=bpy.data.worlds.new('Studio')
scene.world.color=(.13,.13,.13)
bpy.ops.object.camera_add(location=(.1,-.43,.5))
camera=bpy.context.object; camera.name='Shogi collection delivery camera'; camera.data.type='ORTHO'; camera.data.ortho_scale=.49
camera.rotation_euler=(Vector((0,.04,0))-camera.location).to_track_quat('-Z','Y').to_euler(); scene.camera=camera
for name,location,power,size in [('Warm key',(-.2,-.2,.4),12,.16),('Soft fill',(.3,-.1,.3),6,.14),('Rim',(.1,.35,.25),10,.12)]:
    bpy.ops.object.light_add(type='POINT',location=location); light=bpy.context.object; light.name=name; light.data.energy=power; light.data.shadow_soft_size=size
scene.view_settings.view_transform='Khronos PBR Neutral'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'ops/assets/shogi/collection.blend'))
bpy.ops.object.select_all(action='DESELECT')
for parent in roots:
    parent.select_set(True)
    for child in parent.children: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'collection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
scene.render.filepath=str(output/'collection.png'); bpy.ops.render.render(write_still=True)
print('Exported',len(roots),'Shogi roots; portable mesh lettering and shared boxwood bodies.')
