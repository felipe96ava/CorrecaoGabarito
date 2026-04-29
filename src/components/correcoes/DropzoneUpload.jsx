import { useDropzone } from 'react-dropzone';

export default function DropzoneUpload({ onUpload, loading }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [], 'application/pdf': [] },
    onDrop: onUpload,
    disabled: loading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
        isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-white'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      {loading ? (
        <p className="text-gray-500">Processando...</p>
      ) : isDragActive ? (
        <p className="text-blue-600 font-medium">Solte os arquivos aqui</p>
      ) : (
        <>
          <p className="text-gray-600 font-medium">Arraste os cartões-resposta aqui</p>
          <p className="text-sm text-gray-400 mt-1">ou clique para selecionar · JPG, PNG, PDF</p>
        </>
      )}
    </div>
  );
}
