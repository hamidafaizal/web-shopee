import Navigation from './Navigation';

export default function Layout({ children, activeTab, setActiveTab }) {
  return (
    <div className="content">
      <h1 style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <i className="bi bi-lightning-charge"></i> Ayo Cari Produk Winning!
      </h1>
      
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div id="alertContainer" style={{ width: '100%', maxWidth: '900px' }}></div>
      
      {children}
    </div>
  );
}