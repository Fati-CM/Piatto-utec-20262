import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { menus } from '../mocks/menus';

type Role = 'guest'|'customer'|'staff';

function Header({role,setRole}:{role:Role;setRole:(r:Role)=>void}){
  return <header style={{background:'#178000',color:'#fff',padding:'16px 0'}}>
    <div className="container" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
      <Link to="/" style={{fontWeight:900,fontSize:30}}>Piatto</Link>
      <nav style={{display:'flex',gap:8,alignItems:'center'}}>
        {role==='staff' && <Link className="btn" style={{background:'#fff',color:'#178000'}} to="/staff">Pedidos</Link>}
        {role==='guest' ? <>
          <button className="btn" onClick={()=>setRole('customer')}>Login</button>
          <button className="btn" style={{background:'#fff',color:'#178000'}} onClick={()=>setRole('customer')}>Registro</button>
        </> : <button className="btn" style={{background:'#fff',color:'#178000'}} onClick={()=>setRole('guest')}>{role==='staff'?'Staff':'Usuario'}</button>}
      </nav>
    </div>
  </header>
}

function MenuPage({role}:{role:Role}){
  return <main className="container" style={{padding:'28px 0'}}>
    <h1 style={{color:'#178000'}}>Menú de hoy</h1>
    <p>Lunes 02 al sábado 07 de noviembre</p>
    <div className="grid">{menus.map(m=><article className="card" key={m.id}>
      <div style={{height:110,background:'#eef1ed',borderRadius:12,display:'grid',placeItems:'center'}}>Foto del plato</div>
      <p style={{color:'#178000'}}>{m.category}</p>
      <h2 style={{color:'#2563eb'}}>S/ {m.price.toFixed(2)}</h2>
      <p>{m.description}</p>
      <small>{m.availability}</small>
      <div style={{marginTop:12}}><Link className="btn btn-secondary" to={`/menu/${m.id}`}>{role==='guest'?'Ver detalle':'Separar'}</Link></div>
    </article>)}</div>
  </main>
}

function StudentDetail({role}:{role:Role}){
  const [selected,setSelected]=useState<string|null>(null); const [attempted,setAttempted]=useState(false);
  const invalid = attempted && !selected;
  return <main className="container" style={{padding:'28px 0'}}>
    <h1 style={{color:'#178000'}}>Menú estudiantil</h1>
    <div style={{display:'grid',gap:12,gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
      {menus.find(m=>m.id==='est')!.options!.map(o=><button key={o.id} onClick={()=>role!=='guest'&&setSelected(o.id)} className="card" style={{textAlign:'left',borderColor: invalid?'#8d1f28': selected===o.id?'#178000':'#dce3d9'}}>
        <strong>{o.name}</strong><p>{o.description}</p>{selected===o.id&&<span>✓ Seleccionado</span>}
      </button>)}
    </div>
    {role==='guest' && <p style={{color:'#8d1f28'}}>Inicia sesión para continuar</p>}
    {invalid && <p style={{color:'#8d1f28'}}>Selecciona 1 o 2</p>}
    <button className={`btn ${selected?'btn-primary':'btn-disabled'}`} style={{marginTop:12}} aria-disabled={!selected} onClick={()=>{if(!selected)setAttempted(true)}}>Separar menú</button>
  </main>
}

function MenuDetail({role}:{role:Role}){ return <StudentDetail role={role}/>; }
function Staff(){return <main className="container" style={{padding:'28px 0'}}><h1 style={{color:'#178000'}}>Panel Piatto</h1><div className="card"><h2>Pedidos de hoy</h2><p>Verificación manual y lectura QR.</p><button className="btn btn-primary">Abrir lector QR</button></div></main>}

export default function App(){
  const [role,setRole]=useState<Role>('guest');
  const value=useMemo(()=>({role,setRole}),[role]);
  return <BrowserRouter><Header {...value}/><Routes>
    <Route path="/" element={<MenuPage role={role}/>}/>
    <Route path="/menu/:id" element={<MenuDetail role={role}/>}/>
    <Route path="/staff" element={role==='staff'?<Staff/>:<MenuPage role={role}/>}/>
  </Routes></BrowserRouter>
}
