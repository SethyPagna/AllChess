"""Original Xiangqi/Janggi pieces, Blender 5.2, metre scale.

blender --background --python ops/assets/intersection/build_collections.py -- xiangqi FONT.otf
Repeat with janggi and Noto Serif CJK KR Bold. See README.md for font provenance.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

repo = Path(__file__).resolve().parents[3]
args = sys.argv[sys.argv.index('--')+1:]
variant, font_path = args[0], Path(args[1]).resolve()
assert variant in ['xiangqi', 'janggi']
output = repo / 'public/assets' / variant
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
font = bpy.data.fonts.load(str(font_path))

def material(name, colour, ink=False):
    mat=bpy.data.materials.new(name); mat.diffuse_color=(*colour,1); mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*colour,1)
    shader.inputs['Roughness'].default_value=.95 if ink else .34
    shader.inputs['Specular IOR Level'].default_value=.05 if ink else .4
    shader.inputs['Coat Weight'].default_value=0 if ink else .25
    return mat

body_mat=material('Polished boxwood' if variant=='xiangqi' else 'Warm ivory ceramic', (.79,.55,.28) if variant=='xiangqi' else (.83,.78,.65))
red_ink=material('Han red ink' if variant=='janggi' else 'Red ink', (.48,.013,.007),True)
other_ink=material('Cho blue ink' if variant=='janggi' else 'Black ink', (.009,.06,.20) if variant=='janggi' else (.01,.008,.006),True)
felt=material('Felt sole',(.017,.03,.025),True)
surface=material('Gallery lacquer',(.035,.026,.023))
names=['general','advisor','elephant','horse','chariot','cannon','soldier']
letters={
    'xiangqi': {'light':['帥','仕','相','傌','俥','炮','兵'], 'dark':['將','士','象','馬','車','砲','卒']},
    'janggi': {'light':['漢','士','象','馬','車','包','兵'], 'dark':['楚','士','象','馬','車','包','卒']}
}[variant]
roots=[]

def mesh_object(name, verts, faces, mat, parent):
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update(); mesh.materials.append(mat)
    uv=mesh.uv_layers.new(name='Timber UV')
    for polygon in mesh.polygons:
        for index in polygon.loop_indices:
            p=mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv=(p.x/.05+.5,p.y/.05+.5)
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); obj.parent=parent
    return obj

def lathe(name, profile, mat, parent, segments=48, caps=True):
    verts=[(radius*math.cos(2*math.pi*i/segments),radius*math.sin(2*math.pi*i/segments),z) for radius,z in profile for i in range(segments)]
    faces=[]
    for j in range(len(profile)-1):
        for i in range(segments):
            a=j*segments+i; b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    if caps: faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))])
    obj=mesh_object(name,verts,faces,mat,parent)
    # Keep the lettering face flat; smooth only the turned side-wall strips.
    for face in obj.data.polygons[:-2]: face.use_smooth=True
    return obj

def glyph(parent, character, diameter, height, mat):
    curve=bpy.data.curves.new('Character outline','FONT'); curve.body=character; curve.font=font
    curve.align_x='CENTER'; curve.align_y='CENTER'; curve.size=.03; curve.extrude=.00005; curve.resolution_u=4
    obj=bpy.data.objects.new('Ink '+character,curve); bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH')
    low=[min(v.co[i] for v in obj.data.vertices) for i in [0,1]]; high=[max(v.co[i] for v in obj.data.vertices) for i in [0,1]]
    scale=min(diameter*.65/(high[0]-low[0]),diameter*.65/(high[1]-low[1]))
    for vertex in obj.data.vertices:
        for axis in [0,1]: vertex.co[axis]=(vertex.co[axis]-(low[axis]+high[axis])/2)*scale
    obj.data.materials.append(mat); obj.parent=parent; obj.location.z=height+.0002

for side in ['light','dark']:
    ink=red_ink if side=='light' else other_ink
    for index,name in enumerate(names):
        parent=bpy.data.objects.new(f'{side}_{name}',None); bpy.context.collection.objects.link(parent); roots.append(parent)
        if variant=='xiangqi':
            diameter=.042; radius=diameter/2; height=.012
            lathe('Turned boxwood disc',[(radius*.88,.0003),(radius*.98,.0015),(radius,.003),(radius,.009),(radius*.98,.0108),(radius*.92,height),(0,height)],body_mat,parent)
            lathe('Ink face ring',[(radius*.83,height+.00012),(radius*.86,height+.00012),(radius*.86,height+.00024),(radius*.83,height+.00024),(radius*.83,height+.00012)],ink,parent,caps=False)
            lathe('Felt sole',[(radius*.86,0),(radius*.86,.0003)],felt,parent)
        else:
            diameter=.049 if name=='general' else .036 if name in ['advisor','soldier'] else .043
            height=.014 if name=='general' else .0095 if name in ['advisor','soldier'] else .0115
            radius=diameter/2
            verts=[(radius*math.cos(math.pi/8+2*math.pi*i/8),radius*math.sin(math.pi/8+2*math.pi*i/8),z) for z in [0,height] for i in range(8)]
            faces=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
            obj=mesh_object('Octagonal rank tile',verts,faces,body_mat,parent)
            bevel=obj.modifiers.new('Handled ceramic edge','BEVEL'); bevel.width=.0008; bevel.segments=3
            obj.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
        glyph(parent,letters[side][index],diameter,height,ink)
        parent.location=((index-3)*.055,.037 if side=='dark' else -.032,0)

bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.007))
plinth=bpy.context.object; plinth.name='Presentation plinth'; plinth.dimensions=(.413,.15,.014)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); plinth.data.materials.append(surface)
bevel=plinth.modifiers.new('Soft lacquer edge','BEVEL'); bevel.width=.004; bevel.segments=3
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1100; scene.render.resolution_y=620; scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE'; scene.render.image_settings.file_format='PNG'
if not scene.world: scene.world=bpy.data.worlds.new('Gallery ambient')
scene.world.color=(.13,.13,.13)
bpy.ops.object.camera_add(location=(.08,-.36,.39)); camera=bpy.context.object; camera.name='Collection delivery camera'
camera.data.type='ORTHO'; camera.data.ortho_scale=.47; camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler(); scene.camera=camera
for name,position,power,size in [('Key',(-.2,-.2,.4),10,.16),('Fill',(.3,-.1,.3),5,.14),('Rim',(.1,.3,.3),9,.12)]:
    bpy.ops.object.light_add(type='POINT',location=position); light=bpy.context.object; light.name=name; light.data.energy=power; light.data.shadow_soft_size=size
scene.view_settings.view_transform='Khronos PBR Neutral'
bpy.ops.wm.save_as_mainfile(filepath=str(repo/f'ops/assets/intersection/{variant}.blend'))
bpy.ops.object.select_all(action='DESELECT')
for parent in roots:
    parent.select_set(True)
    for child in parent.children: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'collection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
scene.render.filepath=str(output/'collection.png'); bpy.ops.render.render(write_still=True)
print('Exported',variant,'with',len(roots),'semantic roots.')
