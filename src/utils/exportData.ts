import { Project } from '@/hooks/useProjects';

const businessModelLabels: Record<string, string> = {
  inside_sales: 'Inside Sales',
  ecommerce: 'E-commerce',
  pdv: 'PDV',
};

export function exportProjectsToCSV(projects: Project[]): void {
  const headers = [
    'Nome',
    'ID da Conta',
    'Modelo de Negócio',
    'Fuso Horário',
    'Moeda',
    'Status de Sincronização',
    'Última Sincronização',
    'Arquivado',
    'Data de Criação',
  ];

  const rows = projects.map((project) => [
    project.name,
    project.ad_account_id,
    businessModelLabels[project.business_model] || project.business_model,
    project.timezone,
    project.currency,
    project.webhook_status || 'Pendente',
    project.last_sync_at ? new Date(project.last_sync_at).toLocaleString('pt-BR') : 'Nunca',
    project.archived ? 'Sim' : 'Não',
    new Date(project.created_at).toLocaleString('pt-BR'),
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `projetos_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportProjectsToExcel(projects: Project[]): void {
  const headers = [
    'Nome',
    'ID da Conta',
    'Modelo de Negócio',
    'Fuso Horário',
    'Moeda',
    'Status de Sincronização',
    'Última Sincronização',
    'Arquivado',
    'Data de Criação',
  ];

  const rows = projects.map((project) => [
    project.name,
    project.ad_account_id,
    businessModelLabels[project.business_model] || project.business_model,
    project.timezone,
    project.currency,
    project.webhook_status || 'Pendente',
    project.last_sync_at ? new Date(project.last_sync_at).toLocaleString('pt-BR') : 'Nunca',
    project.archived ? 'Sim' : 'Não',
    new Date(project.created_at).toLocaleString('pt-BR'),
  ]);

  // Create XML-based Excel format
  let excelContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#4F46E5" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Projetos">
    <Table>
      <Row>
        ${headers.map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join('')}
      </Row>
      ${rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${cell}</Data></Cell>`).join('')}</Row>`).join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `projetos_${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}