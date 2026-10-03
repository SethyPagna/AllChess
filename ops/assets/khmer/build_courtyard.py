"""Courtyard: original faceted Ouk geometry and honed stone materials.
Run: blender -b -t 4 --python ops/assets/khmer/build_courtyard.py
Ses adapts Tina's CC0 Poly Haven Horse Head (horse-source.json); all other
geometry and stone shaders are original. This is a contemporary design,
not a historical replica. Generated image masters guide silhouettes.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[3]
OUT=R/'output/atelier/courtyard'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
scene.render.bake.margin=8


def mat(name,color,rough=.75):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
 return m


def baked_stone(name,low,high):
 """Original UV-tile stone grain. Retain the procedural source nodes in .blend."""
 m=mat(name,high);n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');out=n.get('Material Output')
 uv=n.new('ShaderNodeTexCoord')
 fine=n.new('ShaderNodeTexNoise');fine.name='Original mineral grain';fine.inputs['Scale'].default_value=185;fine.inputs['Detail'].default_value=3;fine.inputs['Roughness'].default_value=.7;l.new(uv.outputs['UV'],fine.inputs['Vector'])
 broad=n.new('ShaderNodeTexNoise');broad.name='Subtle stone cloud';broad.inputs['Scale'].default_value=12;broad.inputs['Detail'].default_value=2;l.new(uv.outputs['UV'],broad.inputs['Vector'])
 mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value=.24;l.new(fine.outputs['Fac'],mix.inputs[1]);l.new(broad.outputs['Fac'],mix.inputs[2])
 ramp=n.new('ShaderNodeValToRGB');ramp.name='Original stone pigments';ramp.color_ramp.elements[0].position=.16;ramp.color_ramp.elements[0].color=(*low,1);ramp.color_ramp.elements[1].position=.84;ramp.color_ramp.elements[1].color=(*high,1);l.new(mix.outputs[0],ramp.inputs[0])
 minerals=n.new('ShaderNodeTexVoronoi');minerals.name='Sparse mineral inclusions';minerals.inputs['Scale'].default_value=38;l.new(uv.outputs['UV'],minerals.inputs['Vector'])
 mask=n.new('ShaderNodeValToRGB');mask.name='Small exposed mineral flecks';mask.color_ramp.elements[0].position=.065;mask.color_ramp.elements[0].color=(.30,.30,.30,1);mask.color_ramp.elements[1].position=.19;mask.color_ramp.elements[1].color=(0,0,0,1);l.new(minerals.outputs['Distance'],mask.inputs[0])
 pigment=n.new('ShaderNodeMixRGB');pigment.name='Stone and mineral pigment';l.new(mask.outputs[0],pigment.inputs[0]);l.new(ramp.outputs[0],pigment.inputs[1]);pigment.inputs[2].default_value=(.11,.10,.085,1) if 'charcoal' in name else (.7392,.6424,.4664,1)
 rough=n.new('ShaderNodeMapRange');rough.name='Honed matte roughness';rough.inputs['To Min'].default_value=.66;rough.inputs['To Max'].default_value=.83;l.new(fine.outputs['Fac'],rough.inputs['Value'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28;bump.inputs['Distance'].default_value=.002;l.new(fine.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])
 l.new(pigment.outputs[0],p.inputs['Base Color']);l.new(rough.outputs[0],p.inputs['Roughness'])
 bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.data.materials.append(m)
 target=n.new('ShaderNodeTexImage');n.active=target
 images={}
 for key,source,size in [('colour',pigment.outputs[0],1024),('roughness',rough.outputs[0],512),('normal',None,512)]:
  cached=OUT/(name.replace(' ','-')+'-'+key+('.png' if key=='normal' else '.jpg'))
  if '--reuse-bakes' in sys.argv and cached.exists() and not ('--rebake-charcoal' in sys.argv and 'charcoal' in name):
   image=bpy.data.images.load(str(cached));image.colorspace_settings.name='sRGB' if key=='colour' else 'Non-Color';image.pack();images[key]=image;continue
  image=bpy.data.images.new(name+' '+key,width=size,height=size,alpha=False)
  if key!='colour':image.colorspace_settings.name='Non-Color'
  target.image=image;n.active=target
  if source:
   emit=n.new('ShaderNodeEmission');l.new(source,emit.inputs['Color']);l.new(emit.outputs[0],out.inputs['Surface']);bpy.ops.object.bake(type='EMIT');n.remove(emit)
  else:
   l.new(p.outputs[0],out.inputs['Surface']);bpy.ops.object.bake(type='NORMAL')
  image.filepath_raw=str(OUT/(name.replace(' ','-')+'-'+key+('.png' if key=='normal' else '.jpg')))
  image.file_format='PNG' if key=='normal' else 'JPEG';image.save();image.pack();images[key]=image
 bpy.data.objects.remove(plane,do_unlink=True);n.remove(target)
 l.new(p.outputs[0],out.inputs['Surface'])
 for key,input_name in [('colour','Base Color'),('roughness','Roughness')]:
  tex=n.new('ShaderNodeTexImage');tex.name='Portable '+key;tex.image=images[key];l.new(tex.outputs['Color'],p.inputs[input_name])
 tex=n.new('ShaderNodeTexImage');tex.name='Portable normal';tex.image=images['normal']
 nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.8;l.new(tex.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs[0],p.inputs['Normal'])
 return m

# Calibrated in the gameplay lighting: keep charcoal carving out of crushed
# blacks and retain sandstone detail beside the brightest board surfaces.
stone=[baked_stone('Courtyard sandstone',(.2992,.2376,.1584),(.5632,.484,.352)),baked_stone('Courtyard charcoal',(.0057,.00475,.0038),(.038,.0342,.0304))]
roots=[]


def mesh(name,verts,faces,material,parent,uvs=None,smooth=False):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();data.materials.append(material)
 uv=data.uv_layers.new(name='Stone UV')
 for poly in data.polygons:
  poly.use_smooth=smooth
  for j in poly.loop_indices:
   v=data.vertices[data.loops[j].vertex_index].co
   uv.data[j].uv=(v.x/.055+.5,v.y/.055+.5) if abs(poly.normal.z)>.97 else uvs[data.loops[j].vertex_index] if uvs else ((v.y if abs(poly.normal.x)>=abs(poly.normal.y) else v.x)/.055+.5,v.z/.065)
 bm=bmesh.new();bm.from_mesh(data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00000001)
 bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00000001)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.parent=parent
 return ob


def repair_uv(ob):
 data=ob.data;data.update();uv=data.uv_layers.get('Stone UV')
 if not uv:return
 for poly in data.polygons:
  coords=[uv.data[i].uv for i in poly.loop_indices]
  area=abs(sum(coords[i].x*coords[(i+1)%len(coords)].y-coords[(i+1)%len(coords)].x*coords[i].y for i in range(len(coords))))*.5
  if area>1e-10 or poly.area<1e-12:continue
  n=poly.normal
  for li in poly.loop_indices:
   v=data.vertices[data.loops[li].vertex_index].co
   uv.data[li].uv=(v.x/.055+.5,v.y/.055+.5) if abs(n.z)>=max(abs(n.x),abs(n.y)) else ((v.y if abs(n.x)>=abs(n.y) else v.x)/.055+.5,v.z/.065)


def bevel(ob,width=.00022,segments=2):
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 modifier=ob.modifiers.new('Hand eased arrises','BEVEL');modifier.width=width;modifier.segments=segments
 bpy.ops.object.modifier_apply(modifier=modifier.name)
 # Keep planar stone faces crisp and softened edges smooth.
 for face in ob.data.polygons:face.use_smooth=False
 repair_uv(ob)
 return ob


def split_facets(ob):
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 modifier=ob.modifiers.new('Crisp carved facet boundaries','EDGE_SPLIT');modifier.split_angle=math.radians(30);modifier.use_edge_angle=True
 bpy.ops.object.modifier_apply(modifier=modifier.name)


def oct_profile(name,profile,material,parent,cap=True):
 n=8;vertices=[];uv=[]
 for radius,z in profile:
  for i in range(n+1):
   a=2*math.pi*i/n+math.pi/8;vertices.append((radius*math.cos(a),radius*math.sin(a),z));uv.append((i/n,z/.065))
 faces=[(j*9+i,j*9+i+1,(j+1)*9+i+1,(j+1)*9+i) for j in range(len(profile)-1) for i in range(8)]
 if cap:faces += [tuple(reversed(range(8))),tuple((len(profile)-1)*9+i for i in range(8))]
 return bevel(mesh(name,vertices,faces,material,parent,uv))


def foot(parent,material,radius=.019,height=.014):
 # Three octagonal terraces, each visibly separate at playing scale.
 r=radius;h=height
 return oct_profile('Three terraced octagonal foot',[(r*.90,0),(r,.0007),(r,h*.30),(r*.89,h*.34),(r*.89,h*.57),(r*.76,h*.61),(r*.76,h*.82),(r*.61,h)],material,parent)


def panelled_shaft(parent,material,z0,z1,r0,r1,pointed=True):
 """Each planar face has a real recessed pointed panel, including side walls."""
 vertices=[];faces=[]
 for i in range(8):
  a=(i+.5)*math.pi/4+math.pi/8;normal=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0))
  def point(u,z,depth=0):
   r=r0+(r1-r0)*(z-z0)/(z1-z0)
   return tuple(normal*(r*math.cos(math.pi/8)-depth)+side*u+Vector((0,0,z)))
  w0=r0*math.sin(math.pi/8);w1=r1*math.sin(math.pi/8);h=z1-z0
  outer=[(-w0,z0),(w0,z0),(w1,z1),(0,z1),(-w1,z1)]
  upper=z1-h*(.23 if pointed else .16)
  inner=[(-w0*.62,z0+h*.16),(w0*.62,z0+h*.16),(w1*.65,upper),(0,z1-h*.07 if pointed else upper),(-w1*.65,upper)]
  start=len(vertices);vertices += [point(u,z) for u,z in outer]+[point(u,z) for u,z in inner]+[point(u,z,.00065) for u,z in inner]
  for j in range(5):
   k=(j+1)%5;faces += [(start+j,start+k,start+5+k,start+5+j),(start+5+j,start+5+k,start+10+k,start+10+j)]
  faces.append(tuple(start+10+j for j in range(5)))
 ob=mesh('Recessed pointed shaft panels',vertices,faces,material,parent)
 # Surface-only panelled shaft is closed by the intersecting foot and collar.
 return bevel(ob,.00010,2)


def lotus(parent,material,z0,height,radius,petals=8):
 profile=[(.28,0),(.64,.05),(.90,.17),(1,.30),(.96,.44),(.83,.61),(.62,.76),(.38,.90),(.12,.985),(.012,1)]
 n=96;vertices=[];uv=[]
 for r,z in profile:
  for i in range(n+1):
   a=2*math.pi*i/n+math.pi/8
   # Narrow actual channels at petal boundaries; faceted broad petal planes.
   wave=math.cos(petals*(a-math.pi/8));channel=((1+wave)*.5)**10
   groove=.00068*channel*math.sin(math.pi*min(.995,z+.04))
   rr=max(.000025,radius*r-groove)
   vertices.append((rr*math.cos(a),rr*math.sin(a),z0+z*height));uv.append((i/n,(z0+z*height)/.065))
 faces=[(j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i) for j in range(len(profile)-1) for i in range(n)]
 faces += [tuple(reversed(range(n))),tuple((len(profile)-1)*(n+1)+i for i in range(n))]
 core=mesh('Lotus heart with carved petal channels',vertices,faces,material,parent,uv,True)
 # A second ring of individually shaped petals rises from the same closed bud.
 # Their lifted edges and pointed tips are geometry, visible in orbit silhouettes.
 def profile_radius(t):
  for j in range(len(profile)-1):
   ra,za=profile[j];rb,zb=profile[j+1]
   if za<=t<=zb:return radius*(ra+(rb-ra)*(t-za)/(zb-za))
  return radius*.012
 for petal in range(8):
  center=(petal+.5)*math.pi/4+math.pi/8;v=[];uv=[];f=[];rings=12;across=10
  for j in range(rings+1):
   q=j/rings;t=.035+q*(.77 if petal%2==0 else .70)
   span=math.pi/8*.95*math.sin(math.pi*q)**.52
   for k in range(across+1):
    u=2*k/across-1;a=center+span*u
    rr=profile_radius(t)+.00078*math.sin(math.pi*q)*(1-.28*u*u)
    v.append((rr*math.cos(a),rr*math.sin(a),z0+t*height));uv.append((a/(2*math.pi),(z0+t*height)/.065))
  for j in range(rings):
   for k in range(across):
    at=j*(across+1)+k;f.append((at,at+1,at+across+2,at+across+1))
  ob=mesh('Overlapping pointed lotus petal '+str(petal+1),v,f,material,parent,uv,True)
  bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
  solid=ob.modifiers.new('Carved petal depth','SOLIDIFY');solid.thickness=.0003;solid.offset=-1;bpy.ops.object.modifier_apply(modifier=solid.name);repair_uv(ob)
 return core


def fluted_bowl(parent,material):
 # A continuous outer wall, substantial rim, inner wall and solid inner floor.
 profile=[(.009,.016),(.010,.018),(.013,.021),(.016,.025),(.019,.030),(.020,.032),(.0197,.034),(.0174,.034),(.0169,.032),(.0155,.028),(.012,.025),(.006,.024),(.00001,.024)]
 n=96;v=[];uv=[];f=[]
 for j,(radius,z) in enumerate(profile):
  for i in range(n+1):
   a=2*math.pi*i/n+math.pi/8
   centered=(a-math.pi/4+math.pi/8)%(math.pi/4)-math.pi/8
   rr=radius*math.cos(math.pi/8)/math.cos(centered)
   if j<5:rr-=.00062*math.cos(centered*4)**6*math.sin(math.pi*(z-.016)/.018)
   v.append((rr*math.cos(a),rr*math.sin(a),z));uv.append((i/n,z/.065))
 for j in range(len(profile)-1):
  for i in range(n):f.append((j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i))
 f += [tuple(reversed(range(n))),tuple((len(profile)-1)*(n+1)+i for i in range(n))]
 ob=mesh('Touk fluted hollow octagonal bowl',v,f,material,parent,uv,True)
 split_facets(ob)
 return ob



def counter(parent,material):
 oct_profile('Trey softened lower edge',[(.0155,0),(.0165,.0007),(.0165,.0012)],material,parent)
 panelled_shaft(parent,material,.0007,.0062,.0165,.0165,False)
 profile=[(.0165,.0062),(.0148,.0068),(.0148,.0087),(.0130,.0104),(.0122,.0104),(.0121,.0100),(.0119,.0100),(.0118,.0104),(.0040,.0104),(.0032,.01015),(.0028,.0095),(.00001,.0094)]
 n=96;v=[];uv=[];f=[]
 for radius,z in profile:
  for i in range(n+1):
   a=2*math.pi*i/n+math.pi/8;centered=(a-math.pi/4+math.pi/8)%(math.pi/4)-math.pi/8
   rr=radius*math.cos(math.pi/8)/math.cos(centered) if radius>.004 else radius
   v.append((rr*math.cos(a),rr*math.sin(a),z));uv.append((i/n,z/.065))
 for j in range(len(profile)-1):
  for i in range(n):f.append((j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i))
 f += [tuple(reversed(range(n))),tuple((len(profile)-1)*(n+1)+i for i in range(n))]
 ob=mesh('Trey inset octagonal top and circular thumb recess',v,f,material,parent,uv,True)
 split_facets(ob)

bpy.ops.import_scene.gltf(filepath=str(R/'output/atelier/source/horse_head.gltf'))
source_horse=bpy.data.objects['horse_head'];source_horse.hide_render=True;source_horse.hide_viewport=True
head_normal=next(n.image for n in source_horse.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'nor_gl' in n.image.name);head_normal.pack()


def horse(parent,material):
 foot(parent,material,.0185,.0115)
 oct_profile('Ses octagonal plinth collar',[(.0115,.0105),(.0125,.0115),(.0125,.014),(.0105,.015)],material,parent)
 data=source_horse.data.copy();ob=bpy.data.objects.new('Ses chisel-cut anatomical stone bust',data);scene.collection.objects.link(ob);ob.parent=parent
 bm=bmesh.new();bm.from_mesh(data)
 result=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,.072),plane_no=(0,0,1),clear_inner=True)
 boundary=[e for e in result['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
 if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
 scale=.049/(.41870254-.072)
 for v in data.vertices:
  v.co=Vector((v.co.x*.95,(v.co.y+.056)*.90,v.co.z-.072))*scale+Vector((0,0,.013))
  if .014<v.co.z<.043:
   plane=.0078-.05*(v.co.z-.025)
   v.co.x=max(-plane,min(plane,v.co.x))
 data.update()
 original_uv=data.uv_layers[0].name
 uv=data.uv_layers.new(name='Ses stone grain')
 for poly in data.polygons:
  for li in poly.loop_indices:
   v=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/.055+.5,v.y/.055+.5) if abs(poly.normal.z)>.8 else ((v.y if abs(poly.normal.x)>=abs(poly.normal.y) else v.x)/.055+.5,v.z/.065)
 m=material.copy();m.name=material.name+' Ses relief';n=m.node_tree.nodes;l=m.node_tree.links
 grain=n.new('ShaderNodeUVMap');grain.uv_map=uv.name;detail=n.new('ShaderNodeUVMap');detail.uv_map=original_uv
 for node in n:
  if node.type=='TEX_IMAGE':
   if node.name=='Portable normal':node.image=head_normal;l.new(detail.outputs['UV'],node.inputs['Vector'])
   else:l.new(grain.outputs['UV'],node.inputs['Vector'])
  elif node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.66;node.uv_map=original_uv
 data.materials.clear();data.materials.append(m)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 dec=ob.modifiers.new('Carved stone facets','DECIMATE');dec.ratio=.52;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
 for p in ob.data.polygons:p.use_smooth=True
 split_facets(ob)
 return ob


for side,material in zip(['light','dark'],stone):
 for index,role in enumerate(['Khon_king','Neang_queen','Koul_bishop','Ses_horse','Touk_boat','Trey_fish']):
  root=bpy.data.objects.new(side+'_'+role,None);scene.collection.objects.link(root);roots.append(root)
  if role=='Ses_horse':horse(root,material)
  elif role=='Trey_fish':
   counter(root,material)
  elif role=='Touk_boat':
   foot(root,material,.0175,.009)
   panelled_shaft(root,material,.0085,.017,.0102,.0085)
   fluted_bowl(root,material)
  else:
   if role=='Khon_king':z0,z1,r0,r1,rz,collars,bud=(.013,.034,.0117,.0091,.0106,[(.034,.0115),(.042,.0110),(.050,.0105)],(.0515,.0225,.0095))
   elif role=='Neang_queen':z0,z1,r0,r1,rz,collars,bud=(.010,.030,.0119,.0097,.0105,[(.030,.0122)],(.0325,.0215,.0120))
   else:z0,z1,r0,r1,rz,collars,bud=(.010,.013,.0105,.0105,.0105,[(.013,.0110)],(.015,.031,.0132))
   foot(root,material,.019 if role=='Khon_king' else .018,.014 if role=='Khon_king' else .0105)
   if role!='Koul_bishop':panelled_shaft(root,material,z0,z1,r0,r1)
   oct_profile('Faceted upper shaft',[(r1,z1-.0007),(r1,bud[0])],material,root)
   for z,r in collars:
    oct_profile('Octagonal neck collar',[(r*.83,z-.001),(r,z),(r,z+.0018),(r*.85,z+.0024)],material,root)
   lotus(root,material,*bud)
  root.location=((index-2.5)*.052,-.036 if side=='light' else .036,0)

bpy.data.objects.remove(source_horse,do_unlink=True)
# Check evaluated delivery geometry and keep a machine-readable local audit.
audit={}
for root in roots:
 vertices=[];tris=0
 for ob in root.children_recursive:
  if ob.type!='MESH':continue
  ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles)
  vertices += [ob.matrix_local@v.co for v in ob.data.vertices]
 mn=[min(v[i] for v in vertices) for i in range(3)];mx=[max(v[i] for v in vertices) for i in range(3)]
 audit[root.name]={'triangles':tris,'min':mn,'max':mx,'height':mx[2]-mn[2]}
 if tris>25000:raise RuntimeError(root.name+' exceeds triangle budget')
 if mx[2]>.0741:raise RuntimeError(root.name+' exceeds height')
(OUT/'geometry-audit.json').write_text(json.dumps(audit,indent=2))
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
 root.select_set(True)
 for ob in root.children_recursive:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/'public/assets/khmer/courtyard.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_image_format='AUTO',export_yup=True)

scene.world=bpy.data.worlds.new('Courtyard studio ambient');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.78,.83,.9,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.22
for name,pos,power,size,color in [('Key',(-.20,-.22,.25),3.4,.20,(1,.93,.82)),('Fill',(.24,-.07,.17),1.0,.18,(.85,.94,1)),('Rim',(.03,.20,.23),3.0,.14,(1,.95,.87))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,.028))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Courtyard review camera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=.37
camera.location=(.10,-.40,.23);camera.rotation_euler=(Vector((0,0,.027))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1400;scene.render.resolution_y=760;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(R/'ops/assets/khmer/courtyard.blend'))
scene.render.filepath=str(R/'ops/assets/khmer/courtyard-preview.png');bpy.ops.render.render(write_still=True)
if '--collection-only' not in sys.argv:
 for root in roots:
  for ob in root.children_recursive:ob.hide_render=root.name!='light_Ses_horse'
 horse_root=bpy.data.objects['light_Ses_horse'];horse_root.location=(0,0,0)
 scene.render.resolution_x=scene.render.resolution_y=800;data.ortho_scale=.082
 for name,pos in [('horse-side',(.20,-.04,.075)),('horse-front',(.025,-.22,.075)),('horse-back',(.10,.20,.075))]:
  camera.location=pos;camera.rotation_euler=(Vector((0,0,.031))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
print('COURTYARD_COMPLETE',json.dumps(audit))
