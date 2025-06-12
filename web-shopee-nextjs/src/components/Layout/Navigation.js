export default function Navigation({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'upload', label: 'Upload File Riset', icon: <i className="bi bi-cloud-upload"></i> },
    { id: 'komreg', label: 'KOMREG', icon: <i className="bi bi-collection"></i> },
    { id: 'filter', label: 'Siap Kirim Wa', icon: <i className="bi bi-filter-circle"></i> }
  ];

  return (
    <nav>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          type="button"
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </nav>
  );
}