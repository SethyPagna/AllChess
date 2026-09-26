"""Editable contemporary Ouk set, modelled from the generated atelier design masters.
Run: blender -b -t 4 --python ops/assets/khmer/build_atelier.py
Wood scan: CC0 Poly Haven Wood Table 001 (see ops/assets/materials/README.md).
Turned geometry is original. Ses adapts Tina's CC0 Poly Haven Horse Head.
Pinned sources: horse-source.json; no image billboards.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[3]
OUT=R/'output/atelier'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=24; scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'

def mat(name,color,rough=.38,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m

# Bake colour grading into portable UV maps; keep photographed grain in both woods.
source=bpy.data.images.load(str(R/'public/assets/materials/wood-table/colour.jpg'))
normal=bpy.data.images.load(str(R/'public/assets/materials/wood-table/normal.jpg'));normal.colorspace_settings.name='Non-Color'
rough=bpy.data.images.load(str(R/'public/assets/materials/wood-table/roughness.jpg'));rough.colorspace_settings.name='Non-Color'
normal.pack();rough.pack()
rm=mat('Satin roughness bake',(.5,.5,.5));nn=rm.node_tree.nodes;ll=rm.node_tree.links
rt=nn.new('ShaderNodeTexImage');rt.image=rough
mapping=nn.new('ShaderNodeMapRange');mapping.inputs['To Min'].default_value=.43;mapping.inputs['To Max'].default_value=.66;ll.new(rt.outputs['Color'],mapping.inputs['Value'])
em=nn.new('ShaderNodeEmission');ll.new(mapping.outputs[0],em.inputs['Color']);ll.new(em.outputs[0],nn.get('Material Output').inputs['Surface'])
satin=bpy.data.images.new('Satin wood roughness',width=1024,height=1024,alpha=False);satin.colorspace_settings.name='Non-Color'
dest=nn.new('ShaderNodeTexImage');dest.image=satin;nn.active=dest
bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.data.materials.append(rm);bpy.ops.object.bake(type='EMIT')
satin.filepath_raw=str(OUT/'satin-roughness.png');satin.file_format='PNG';satin.save();satin.pack();bpy.data.objects.remove(plane,do_unlink=True)
rough=satin

woods=[]
for name,low,high in [('Waxed boxwood',(.23,.10,.028),(.64,.40,.19)),('Oxblood rosewood',(.020,.004,.002),(.10,.029,.014))]:
 m=mat(name,high);nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
 tex=nodes.new('ShaderNodeTexImage');tex.image=source
 grey=nodes.new('ShaderNodeRGBToBW');links.new(tex.outputs['Color'],grey.inputs[0])
 ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.01;ramp.color_ramp.elements[0].color=(*low,1);ramp.color_ramp.elements[1].position=.14;ramp.color_ramp.elements[1].color=(*high,1);links.new(grey.outputs[0],ramp.inputs[0])
 emit=nodes.new('ShaderNodeEmission');links.new(ramp.outputs['Color'],emit.inputs['Color']);links.new(emit.outputs[0],nodes.get('Material Output').inputs['Surface'])
 baked=bpy.data.images.new(name+' colour 1K',width=1024,height=1024,alpha=False)
 target=nodes.new('ShaderNodeTexImage');target.image=baked;nodes.active=target
 bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.data.materials.append(m)
 scene.render.bake.margin=4;bpy.ops.object.bake(type='EMIT')
 baked.filepath_raw=str(OUT/(name.replace(' ','-')+'.png'));baked.file_format='PNG';baked.save();baked.pack()
 bpy.data.objects.remove(plane,do_unlink=True)
 for node in [tex,grey,ramp,emit]:nodes.remove(node)
 links.new(target.outputs['Color'],p.inputs['Base Color']);links.new(p.outputs[0],nodes.get('Material Output').inputs['Surface'])
 n=nodes.new('ShaderNodeTexImage');n.image=normal
 nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.10;links.new(n.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs[0],p.inputs['Normal'])
 t=nodes.new('ShaderNodeTexImage');t.image=rough;links.new(t.outputs['Color'],p.inputs['Roughness'])
 p.inputs['Coat Weight'].default_value=.04;p.inputs['Coat Roughness'].default_value=.3
 woods.append(m)
brass=mat('Hairline aged brass inlay',(.42,.265,.09),.29,.76)
eye=mat('Carved eye inset',(.024,.013,.007),.4)
roots=[]

def mesh(name,verts,faces,material,parent,uvs=None):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();data.materials.append(material)
 uv=data.uv_layers.new(name='Wood grain UV')
 for poly in data.polygons:
  poly.use_smooth=True
  for j in poly.loop_indices:
   v=data.vertices[data.loops[j].vertex_index].co
   uv.data[j].uv=(v.x/.042+.5,v.z/.07) if uvs is None else uvs[data.loops[j].vertex_index]
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.parent=parent
 return ob

def smooth_profile(points,steps=3):
 result=[]
 for i in range(len(points)-1):
  a=Vector(points[max(0,i-1)]);b=Vector(points[i]);c=Vector(points[i+1]);d=Vector(points[min(len(points)-1,i+2)])
  for j in range(steps):
   t=j/steps;v=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
   result.append((max(.00001,v.x),v.y))
 result.append(points[-1]);return result

def lathe(name,profile,material,parent,flutes=0,depth=0,caps=True):
 profile=smooth_profile(profile);n=64;verts=[];uvs=[]
 lo=min(z for r,z in profile);hi=max(z for r,z in profile)
 for r,z in profile:
  taper=math.sin(math.pi*max(0,min(1,(z-lo)/(hi-lo)))) if hi>lo else 0
  for i in range(n+1):
   t=2*math.pi*i/n;radius=r-depth*(.5+.5*math.cos(flutes*t))**10*taper if flutes else r
   verts.append((radius*math.cos(t),radius*math.sin(t),z));uvs.append((i/n,z/.07))
 faces=[(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(len(profile)-1) for i in range(n)]
 if caps:faces += [tuple(reversed(range(n))),tuple((len(profile)-1)*(n+1)+i for i in range(n))]
 return mesh(name,verts,faces,material,parent,uvs)

base=[(.0001,0),(.0145,0),(.0168,.0007),(.0176,.0015),(.0178,.003),(.0175,.0045),(.0168,.0055),(.0152,.0061),(.0169,.0073),(.0175,.009),(.0167,.011),(.0145,.0125),(.012,.013)]

def inlay(parent,r=.01792,z=.0022):
 return lathe('Flush brass foot inlay',[(r-.00015,z),(r,z+.00012),(r,z+.0011),(r-.00015,z+.0012)],brass,parent)

def torus(name,r,z,tube,material,parent):
 profile=[(r+tube*math.cos(t*2*math.pi/24),z+tube*math.sin(t*2*math.pi/24)) for t in range(25)]
 return lathe(name,profile,material,parent,caps=False)

# Preserve the source UVs for sculpted mane/face relief; add separate wood-grain UVs.
bpy.ops.import_scene.gltf(filepath=str(R/'output/atelier/source/horse_head.gltf'))
source_horse=bpy.data.objects['horse_head']
head_normal=next(n.image for n in source_horse.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'nor_gl' in n.image.name)
head_normal.pack()
source_horse.hide_render=True;source_horse.hide_viewport=True

def horse(parent,material):
 lathe('Ses turned foot',base+[(.0125,.014),(.012,.015)],material,parent);inlay(parent)
 data=source_horse.data.copy();o=bpy.data.objects.new('Ses carved anatomical bust',data);scene.collection.objects.link(o);o.parent=parent
 bm=bmesh.new();bm.from_mesh(data)
 result=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,.072),plane_no=(0,0,1),clear_inner=True)
 boundary=[e for e in result['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
 if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
 scale=.050/(.41870254-.072)
 for v in data.vertices:v.co=Vector((v.co.x,v.co.y+.056,v.co.z-.072))*scale+Vector((0,0,.014))
 original_uv=data.uv_layers[0].name
 uv=data.uv_layers.new(name='Sculpt wood grain')
 for poly in data.polygons:
  poly.use_smooth=True
  for li in poly.loop_indices:
   v=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(v.y/.060+.5,v.z/.075)
 m=material.copy();m.name=material.name+' Ses relief';nodes=m.node_tree.nodes;links=m.node_tree.links
 grain=nodes.new('ShaderNodeUVMap');grain.uv_map=uv.name
 detail=nodes.new('ShaderNodeUVMap');detail.uv_map=original_uv
 for node in nodes:
  if node.type=='TEX_IMAGE':
   if node.image==normal:node.image=head_normal;links.new(detail.outputs['UV'],node.inputs['Vector'])
   else:links.new(grain.outputs['UV'],node.inputs['Vector'])
  elif node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.8;node.uv_map=original_uv
 data.materials.clear();data.materials.append(m)

for si,side in enumerate(['light','dark']):
 material=woods[si]
 for i,name in enumerate(['Khon_king','Neang_queen','Koul_bishop','Ses_horse','Touk_boat','Trey_fish']):
  parent=bpy.data.objects.new(side+'_'+name,None);scene.collection.objects.link(parent);roots.append(parent)
  if name=='Ses_horse':horse(parent,material)
  elif name=='Trey_fish':
   lathe('Trey domed counter',[(.0001,0),(.013,0),(.0155,.001),(.016,.0025),(.016,.004),(.0155,.005),(.0135,.0054),(.0134,.006),(.0145,.0065),(.014,.0075),(.011,.0092),(.006,.0103),(.0001,.0106)],material,parent)
   inlay(parent,.0161,.0025)
  elif name=='Touk_boat':
   lathe('Touk hollow turned bowl',base+[(.010,.016),(.008,.020),(.0083,.023),(.010,.026),(.014,.028),(.017,.031),(.0195,.035),(.0205,.038),(.0207,.040),(.020,.0415),(.0188,.042),(.0176,.0414),(.0172,.040),(.0165,.037),(.0145,.034),(.011,.032),(.007,.031),(.0001,.0308)],material,parent);inlay(parent)
   torus('Touk incised rim collar',.0194,.0363,.00036,material,parent)
  else:
   if name=='Khon_king':
    body=base+[(.012,.015),(.010,.018),(.0075,.024),(.0068,.031),(.008,.038),(.010,.041),(.012,.042),(.013,.0437),(.0127,.0452),(.011,.046),(.009,.0465),(.0105,.0475),(.011,.049),(.0098,.0503),(.008,.0506),(.0088,.052),(.0084,.0535),(.006,.054)]
    bud=[(.0035,.0535),(.0065,.055),(.0083,.058),(.008,.062),(.006,.066),(.0035,.070),(.00015,.074)]
   elif name=='Neang_queen':
    body=base+[(.012,.015),(.009,.019),(.007,.025),(.008,.031),(.010,.035),(.012,.0365),(.012,.038),(.010,.0393),(.006,.040)]
    bud=[(.003,.0395),(.006,.041),(.007,.044),(.006,.048),(.0035,.052),(.00015,.057)]
   else:
    body=base+[(.011,.015),(.009,.018),(.0085,.022),(.010,.025),(.011,.026),(.011,.0277),(.009,.029),(.005,.030)]
    bud=[(.003,.0295),(.007,.0315),(.009,.035),(.0085,.039),(.006,.043),(.003,.047),(.00015,.051)]
   lathe('Turned foot waist and collars',body,material,parent);inlay(parent)
   lathe('Incised lotus bud',bud,material,parent,flutes=8 if name=='Khon_king' else 6,depth=.0008)
  parent.location=((i-2.5)*.050,-.032 if si==0 else .032,0)

bpy.data.objects.remove(source_horse,do_unlink=True)

# Keep the editable sculpt and material roles; export only named playable roots.
for image in bpy.data.images:
 if image.source=='FILE' or image.generated_type=='BLANK':
  try:image.pack()
  except RuntimeError:pass
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
 root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/'public/assets/khmer/atelier.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_image_format='AUTO',export_yup=True)

scene.world=bpy.data.worlds.new('Atelier ambient');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.76,.85,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
for name,position,power,size,color in [('Key',(-.20,-.18,.27),5,.20,(1,.91,.80)),('Fill',(.20,-.10,.15),2,.16,(.85,.93,1)),('Rim',(.03,.18,.22),5,.12,(1,.95,.85))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector((0,0,.03))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Atelier review camera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=.36
camera.location=(.10,-.40,.24);camera.rotation_euler=(Vector((0,0,.025))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1200;scene.render.resolution_y=650;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(R/'ops/assets/khmer/atelier.blend'))
scene.render.filepath=str(OUT/'collection-front.png');bpy.ops.render.render(write_still=True)
if '--collection-only' in sys.argv:print('ATELIER_COMPLETE',len(roots));sys.exit(0)
# Three views of the horse, which needs actual depth and an intelligible muzzle.
for root in roots:
 for o in root.children_recursive:o.hide_render=root.name!='light_Ses_horse'
horse_root=bpy.data.objects['light_Ses_horse'];horse_root.location=(0,0,0)
scene.render.resolution_x=scene.render.resolution_y=800;data.ortho_scale=.085
for name,position in [('horse-side',(.20,-.04,.085)),('horse-front',(.025,-.22,.085)),('horse-back',(.10,.20,.085))]:
 camera.location=position;camera.rotation_euler=(Vector((0,0,.033))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print('ATELIER_COMPLETE',len(roots))
