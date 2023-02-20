const express = require('express')
const app = express();
const _ = require('lodash');
const sql = require("mssql");
const url = "mongodb+srv://unit:Unit123@cluster0.zr8h6v5.mongodb.net/?retryWrites=true&w=majority";
const exceljs = require("exceljs");
const moment = require("moment");
const refRegExp = new RegExp('REF-', 'i');

//CORS Header midleware
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(
  express.urlencoded({
    extended: true
  })
)

app.use(express.json())


app.get('/', (req, res) => {
  res.send('Hello World!')
});


/////////////////////////////////////// DATA MIGRATION /////////////////////////////////////////////////////////////

let config = {
  user: 'UniversalODS',
  password: 'k6X,YraUgH3',
  server: 'production-instanda-eastus.database.windows.net',
  database: 'Instanda-Production',
  requestTimeout: 120000,
  // requestTimeout: 500,
  connectionTimeout: 15000,
  pool: {
    max: 10,
    min: 0,
    // evictionRunIntervalMillis: 1000,
    idleTimeoutMillis: 50000
  }
};

// const mongoose = require("mongoose");
// mongoose.set('strictQuery', false);
// const mongoDB = "mongodb+srv://unit:Unit123@cluster0.zr8h6v5.mongodb.net/?retryWrites=true&w=majority";

const getTableData = async function (tableName, noQuery) {
  return new Promise((resolve, reject) => {
    sql.connect(config, function (err) {
      if (err) console.log(err);
      // create Request object      
      var request = new sql.Request();
      // query to the database and get the records
      console.log('Buscando polizas: ', tableName)
      let query = noQuery ? `select * from ${tableName}` : `select * from(select *, row_number() over(partition by PolicyNumber order by PolicyNumber, EffectiveChangeDate desc, IsCancelled desc) as row_number from ${tableName}  where SiteEnvironment = 'Live' and PolicyNumber is not null) as row where row_number = 1 order by PolicyNumber`
      request.query(query, function (err, data) {
        if (err) {
          console.log('------------ TABLE ERROR ---------------')
          console.log(tableName)
          console.log('---------------------------')
          console.log(err)
        }
        if (data) {
          // send records as a response          
          resolve(data.recordset)
        }
        else {
          resolve([])
        }
      });
    });
  });
}

let getDataFromInstadna = function (mongoTableName, instandaTables) {
  instandaTables = instandaTables || [];
  let promises = Promise.all(instandaTables);
  promises.then(values => {
    let producstData = convertProductsArray(values);
    producstData = convertToAcselModel(producstData, mongoTableName);
    generateExcel(producstData, mongoTableName);
  })
}

const convertProductsArray = function (instandaViewData) {
  let productDatas = [];
  _.each(instandaViewData, instandaView => {
    _.each(instandaView, instnadaProduct => {
      let productSelected = _.find(productDatas, { PolicyNumber: instnadaProduct.PolicyNumber });
      if (productSelected) {
        _.assign(productSelected, instnadaProduct);
      } else {
        productDatas.push(instnadaProduct);
      }
    })
  })
  return productDatas;
}

let getPolicyByQuote = function (QuoteRef) {
  let policy = _.find(policies, { quoteRef: QuoteRef });
  return policy ? policy.poliza : 'NO-POLIZA'

}

//Policies
let policies = [


]

//Mapping of all products
const convertToAcselModel = function (productData, productName) {
  switch (productName) {
    case 'A-PA':
    case 'ParaTuAuto':
      console.log(productData[0])
      return _.map(productData, product => {
        let vehicleAge = new Date().getFullYear() - product['AnioFabricacionDefault'] > 0 ? new Date().getFullYear() - product['AnioFabricacionDefault'] : 0;
        vehicleAge = vehicleAge >= 0 ? vehicleAge : 0;
        return {
          codprod: 'A-PA',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'AUTO',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          AutoCeroKM: product['CeroKM'] == 'Yes' ? 'Si' : 'No',
          AutoCombustible: product['AutoCombustible'] == 'Gasolina / Diesel' ? '01' : product['AutoCombustible'] == 'Gas' ? '02' : '03',
          AutoComportamiento: product['AutoComportamiento'] == 'BUENO' ? '01' : '02',
          AutoDocumentoInspeccion: product['DocumentoInspeccion'] || '',
          AutoExigenciasAdaptacion: product['ExigenciasAdaptacion'] ? product['ExigenciasAdaptacion'] == 'Yes' ? '01' : '02' : '',
          AutoMarca: product['AutoMarca'] || '',
          AutoMatriculaChasis: product['MatriculaChasis'] || '',
          AutoMatriculaCilindros: product['MatriculaChasis'] || '',
          AutoMatriculaColor: product['MatriculaColor'] || '',
          AutoMatriculaHPCC: product['MatriculaHPCC'] || '',
          AutoMatriculaMotor: product['MatriculaMotor'] || '',
          AutoModelo: product['AutoModelo'] || '',
          AutoTipoDeInspeccion: product['TipoDeInspeccion'] || '',
          AutoTipoGas: product['AutoCombustible'] == 'Gas' ? product['TipoGas'] : '',
          AutoTipoInstalacion: product['AutoCombustible'] == 'Gas' ? product['TipoInstalacion'] == 'Yes' ? 'Adaptado' : 'De Fábrica' : '',
          AutoTipoUso: '01',
          AutoValor: product['AutoValor'] || product['AutoValorReal'] || '',
          AzureId: '',
          AnoVehiculo: product['AnioFabricacionDefault'] || '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadVehiculo: vehicleAge,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          IncluyeAsistenciaVehicular: product['AsistenciaVehicular'] == 'Yes' ? 'SI' : 'NO',
          IncluyeRentaCar: product['AutoSustitutoDefault'] == 'Rent-A-Car' ? 'SI' : 'No',
          IncluyeUber: product['AutoSustitutoDefault'] == 'UBER' ? 'SI' : 'No',
          IndicadorDescuentoMarcaModelo: product['AutoModeloDescuentoDefault'] ? 1 : '0',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InspeccionCompletada: product['InspeccionCompletada'] || '',
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          MatriculaPlaca: product['MatriculaPlaca'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          PlanSeguroLey: product['ResponsabilidadCivil'] == 'Plan A' ? 'A' : product['ResponsabilidadCivil'] == 'Plan B' ? 'B' : product['ResponsabilidadCivil'] == 'Plan C' ? 'C' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          TipoVehiculo: product['AutoTipo'] == 'AUTO' ? '01' : product['AutoTipo'] == 'CAMIONETA' ? '02' : product['AutoTipo'] == 'SUV' ? '03' : product['AutoTipo'] == 'VAN' ? '04' : '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'A-KM':
    case 'PorLoQueConduces':
      console.log(productData[0])
      return _.map(productData, product => {
        let vehicleAge = new Date().getFullYear() - product['AnioFabricacionDefault'] > 0 ? new Date().getFullYear() - product['AnioFabricacionDefault'] : 0;
        vehicleAge = vehicleAge >= 0 ? vehicleAge : 0;
        return {
          codprod: 'A-KM',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'AUTO',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'],
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'],
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'],
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'],
          AgenteDomicilioSector: product['AgenteDomicilioSector'],
          AgenteIdentificacion: product['AgenteIdentificacion'],
          AgenteNombre1: product['AgenteNombre1'],
          AgenteNombre2: product['AgenteNombre2'],
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'],
          AutoCeroKM: product['CeroKM'] == 'Yes' ? 'Si' : 'No',
          AutoCombustible: product['AutoCombustible'] == 'Gasolina / Diesel' ? '01' : product['AutoCombustible'] == 'Gas' ? '02' : '03',
          AutoComportamiento: product['AutoComportamiento'] == 'BUENO' ? '01' : '02',
          AutoDocumentoInspeccion: product['DocumentoInspeccion'] || '',
          AutoExigenciasAdaptacion: product['ExigenciasAdaptacion'] ? product['ExigenciasAdaptacion'] == 'Yes' ? '01' : '02' : '',
          AutoMarca: product['AutoMarca'] || '',
          AutoMatriculaChasis: product['MatriculaChasis'] || '',
          AutoMatriculaCilindros: product['MatriculaChasis'] || '',
          AutoMatriculaColor: product['MatriculaColor'] || '',
          AutoMatriculaHPCC: product['MatriculaHPCC'] || '',
          AutoMatriculaMotor: product['MatriculaMotor'] || '',
          AutoModelo: product['AutoModelo'] || '',
          AutoTipoDeInspeccion: product['TipoDeInspeccion'] || '',
          AutoTipoGas: product['AutoCombustible'] == 'Gas' ? product['TipoGas'] : '',
          AutoTipoInstalacion: product['AutoCombustible'] == 'Gas' ? product['TipoInstalacion'] == 'Yes' ? 'Adaptado' : 'De Fábrica' : '',
          AutoTipoUso: '01',
          AutoValor: product['AutoValor'] || product['AutoValorReal'] || '',
          AzureId: '',
          AnoVehiculo: product['AnioFabricacionDefault'] || '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] && product['ClienteApellidoMaterno'] != '---------' ? product['ClienteApellidoMaterno'] : product['ClienteApellido2'] && product['ClienteApellido2'] != '---------' ? product['ClienteApellido2'] : '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadVehiculo: vehicleAge,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          IncluyeAsistenciaVehicular: product['AsistenciaVehicular'] == 'Yes' ? 'SI' : 'NO',
          IncluyeRentaCar: product['AutoSustitutoDefault'] == 'Rent-A-Car' ? 'SI' : 'No',
          IncluyeUber: product['AutoSustitutoDefault'] == 'UBER' ? 'SI' : 'No',
          IndicadorDescuentoMarcaModelo: product['AutoModeloDescuentoDefault'] ? 1 : '0',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InspeccionCompletada: product['InspeccionCompletada'] || '',
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          MatriculaPlaca: product['MatriculaPlaca'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          PlanSeguroLey: product['ResponsabilidadCivil'] == 'Plan A' ? 'A' : product['ResponsabilidadCivil'] == 'Plan B' ? 'B' : product['ResponsabilidadCivil'] == 'Plan C' ? 'C' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          TipoVehiculo: product['AutoTipo'] == 'AUTO' ? '01' : product['AutoTipo'] == 'CAMIONETA' ? '02' : product['AutoTipo'] == 'SUV' ? '03' : product['AutoTipo'] == 'VAN' ? '04' : '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          TasaPorKilometro: product['PrecioBrutoKM'],
          MontoFijo: product['KMMaximoCobrar'],
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'A-PT':
    case 'PerdidaTotal':
      console.log(productData[0])
      return _.map(productData, product => {
        let vehicleAge = new Date().getFullYear() - product['AnioFabricacionDefault'] > 0 ? new Date().getFullYear() - product['AnioFabricacionDefault'] : 0;
        vehicleAge = vehicleAge >= 0 ? vehicleAge : 0;
        return {
          codprod: 'A-PT',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'AUTO',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'],
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'],
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'],
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'],
          AgenteDomicilioSector: product['AgenteDomicilioSector'],
          AgenteIdentificacion: product['AgenteIdentificacion'],
          AgenteNombre1: product['AgenteNombre1'],
          AgenteNombre2: product['AgenteNombre2'],
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'],
          AutoCeroKM: product['CeroKM'] == 'Yes' ? 'Si' : 'No',
          AutoCombustible: product['AutoCombustible'] == 'Gasolina / Diesel' ? '01' : product['AutoCombustible'] == 'Gas' ? '02' : '03',
          AutoComportamiento: product['AutoComportamiento'] == 'BUENO' ? '01' : '02',
          AutoDocumentoInspeccion: product['DocumentoInspeccion'] || '',
          AutoExigenciasAdaptacion: product['ExigenciasAdaptacion'] ? product['ExigenciasAdaptacion'] == 'Yes' ? '01' : '02' : '',
          AutoMarca: product['AutoMarca'] || '',
          AutoMatriculaChasis: product['MatriculaChasis'] || '',
          AutoMatriculaCilindros: product['MatriculaChasis'] || '',
          AutoMatriculaColor: product['MatriculaColor'] || '',
          AutoMatriculaHPCC: product['MatriculaHPCC'] || '',
          AutoMatriculaMotor: product['MatriculaMotor'] || '',
          AutoModelo: product['AutoModelo'] || '',
          AutoTipoDeInspeccion: product['TipoDeInspeccion'] || '',
          AutoTipoGas: product['AutoCombustible'] == 'Gas' ? product['TipoGas'] : '',
          AutoTipoInstalacion: product['AutoCombustible'] == 'Gas' ? product['TipoInstalacion'] == 'Yes' ? 'Adaptado' : 'De Fábrica' : '',
          AutoTipoUso: '01',
          AutoValor: product['AutoValor'] || product['AutoValorReal'] || '',
          AzureId: '',
          AnoVehiculo: product['AnioFabricacionDefault'] || '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadVehiculo: vehicleAge,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          IncluyeAsistenciaVehicular: product['AsistenciaVehicular'] == 'Yes' ? 'SI' : 'NO',
          IncluyeRentaCar: product['AutoSustitutoDefault'] == 'Rent-A-Car' ? 'SI' : 'No',
          IncluyeUber: product['AutoSustitutoDefault'] == 'UBER' ? 'SI' : 'No',
          IndicadorDescuentoMarcaModelo: product['AutoModeloDescuentoDefault'] ? 1 : '0',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InspeccionCompletada: product['InspeccionCompletada'] || '',
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          MatriculaPlaca: product['MatriculaPlaca'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          PlanSeguroLey: product['ResponsabilidadCivil'] == 'Plan A' ? 'A' : product['ResponsabilidadCivil'] == 'Plan B' ? 'B' : product['ResponsabilidadCivil'] == 'Plan C' ? 'C' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          TipoVehiculo: product['AutoTipo'] == 'AUTO' ? '01' : product['AutoTipo'] == 'CAMIONETA' ? '02' : product['AutoTipo'] == 'SUV' ? '03' : product['AutoTipo'] == 'VAN' ? '04' : '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),

        }
      })
      break;

    case 'A-PC':
    case 'PorSiChocas':
      console.log(productData[0])
      return _.map(productData, product => {
        let vehicleAge = new Date().getFullYear() - product['AnioFabricacionDefault'] > 0 ? new Date().getFullYear() - product['AnioFabricacionDefault'] : 0;
        vehicleAge = vehicleAge >= 0 ? vehicleAge : 0;
        return {
          codprod: 'A-PC',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'AUTO',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'],
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'],
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'],
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'],
          AgenteDomicilioSector: product['AgenteDomicilioSector'],
          AgenteIdentificacion: product['AgenteIdentificacion'],
          AgenteNombre1: product['AgenteNombre1'],
          AgenteNombre2: product['AgenteNombre2'],
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'],
          AutoCeroKM: product['CeroKM'] == 'Yes' ? 'Si' : 'No',
          AutoCombustible: product['AutoCombustible'] == 'Gasolina / Diesel' ? '01' : product['AutoCombustible'] == 'Gas' ? '02' : '03',
          AutoComportamiento: product['AutoComportamiento'] == 'BUENO' ? '01' : '02',
          AutoDocumentoInspeccion: product['DocumentoInspeccion'] || '',
          AutoExigenciasAdaptacion: product['ExigenciasAdaptacion'] ? product['ExigenciasAdaptacion'] == 'Yes' ? '01' : '02' : '',
          AutoMarca: product['AutoMarca'] || '',
          AutoMatriculaChasis: product['MatriculaChasis'] || '',
          AutoMatriculaCilindros: product['MatriculaChasis'] || '',
          AutoMatriculaColor: product['MatriculaColor'] || '',
          AutoMatriculaHPCC: product['MatriculaHPCC'] || '',
          AutoMatriculaMotor: product['MatriculaMotor'] || '',
          AutoModelo: product['AutoModelo'] || '',
          AutoTipoDeInspeccion: product['TipoDeInspeccion'] || '',
          AutoTipoGas: product['AutoCombustible'] == 'Gas' ? product['TipoGas'] : '',
          AutoTipoInstalacion: product['AutoCombustible'] == 'Gas' ? product['TipoInstalacion'] == 'Yes' ? 'Adaptado' : 'De Fábrica' : '',
          AutoTipoUso: '01',
          AutoValor: product['AutoValor'] || product['AutoValorReal'] || '',
          AzureId: '',
          AnoVehiculo: product['AnioFabricacionDefault'] || '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadVehiculo: vehicleAge,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          IncluyeAsistenciaVehicular: product['AsistenciaVehicular'] == 'Yes' ? 'SI' : 'NO',
          IncluyeRentaCar: product['AutoSustitutoDefault'] == 'Rent-A-Car' ? 'SI' : 'No',
          IncluyeUber: product['AutoSustitutoDefault'] == 'UBER' ? 'SI' : 'No',
          IndicadorDescuentoMarcaModelo: product['AutoModeloDescuentoDefault'] ? 1 : '0',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InspeccionCompletada: product['InspeccionCompletada'] || '',
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          MatriculaPlaca: product['MatriculaPlaca'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          PlanSeguroLey: product['ResponsabilidadCivil'] == 'Plan A' ? 'A' : product['ResponsabilidadCivil'] == 'Plan B' ? 'B' : product['ResponsabilidadCivil'] == 'Plan C' ? 'C' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          TipoVehiculo: product['AutoTipo'] == 'AUTO' ? '01' : product['AutoTipo'] == 'CAMIONETA' ? '02' : product['AutoTipo'] == 'SUV' ? '03' : product['AutoTipo'] == 'VAN' ? '04' : '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'S-EN':
    case 'PorSiTeEnfermas':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'S-EN',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'SEIA',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['ClienteCedula'] || product['ClienteCedulaLlamarAPI'] || '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          CuponMonto: product['CuponMonto'],
          CuponPorcentaje: product['CuponPorcentaje'],
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || 'Cédula',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'F-IN':
    case 'PorSiPierdesTusIngresos':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'F-IN',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'DESE',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['ClienteCedula'] || product['ClienteCedulaLlamarAPI'] || '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          ClienteTiempoEmpleo: product[''],
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          IngresosMensualesMonto: product[''],
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Oficio: product['Oficio'],
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          TipoTrabajador: product[''],
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'F-EH':
    case 'EmergenciasDelHogar':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'F-EH',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'EHOG',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'A-BR':
    case 'ParaTuBici':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'A-BR',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'BICI',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          BiciDocumentoInspeccion: product['BiciDocumentoInspeccion'],
          BiciTipoDeInspeccion: product['BiciTipoDeInspeccion'],
          BiciVideoURL: product['BiciVideoURL'],
          BicicletaAnio: product['BicicletaAnio'],
          BicicletaMarca: product['BicicletaMarca'] || product['BicicletaMarcaModelo'],
          BicicletaModelo: product['BicicletaModelo'],
          BicicletaTipo: product['BicicletaTipo'],
          BicicletaTipoUso: product['BicicletaTipoUso'],
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ChasisBiciImageURL: product['ChasisBiciImageURL'],
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          LateralBiciImageURL: product['LateralBiciImageURL'],
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'A-BR':
    case 'ParaTuBiciReaseguro':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'A-BR',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'BICI',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          BiciDocumentoInspeccion: product['BiciDocumentoInspeccion'],
          BiciTipoDeInspeccion: product['BiciTipoDeInspeccion'],
          BiciVideoURL: product['BiciVideoURL'],
          BicicletaAnio: product['BicicletaAnio'],
          BicicletaMarca: product['BicicletaMarca'] || product['BicicletaMarcaModelo'],
          BicicletaModelo: product['BicicletaModelo'],
          BicicletaTipo: product['BicicletaTipo'],
          BicicletaTipoUso: product['BicicletaTipoUso'],
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ChasisBiciImageURL: product['ChasisBiciImageURL'],
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          LateralBiciImageURL: product['LateralBiciImageURL'],
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'F-AP':
    case 'PorSiTeAccidentas':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'F-AP',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'API',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          BeneficiarioFechaDeNacimiento: '',
          BeneficiarioNombreCompleto: product['BeneficiarioNombreCompleto'] ? product['BeneficiarioNombreCompleto'] : product['BeneficiarioNombre1'] + ' ' + product['BeneficiarioApellido'],
          BeneficiarioNumeroIdentificacion: '',
          BeneficiarioPorcentaje: '',
          BeneficiarioRelacion: '',
          BeneficiarioTipoIdentificacion: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
          OriginalQuoteRef: product['OriginalQuoteRef']
        }
      })
      break;

    case 'PorSiTeAccidentasBeneficiarios':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          numOa: product['Index'],
          Cotizacion: product['QuoteRef'],
          Poliza: getPolicyByQuote(product['QuoteRef']),
          BeneficiarioNombreCompleto: product['BeneficiarioNombreCompleto'] ? product['BeneficiarioNombreCompleto'] : product['BeneficiarioNombre1'] + ' ' + product['BeneficiarioApellido'],
          BeneficiarioTipoIdentificacion: product['BeneficiarioTipoIdentificacion'] ? product['BeneficiarioTipoIdentificacionDefault'] : product['BeneficiarioTipoIdentificacion'],
          BeneficiarioNumeroIdentificacion: product['BeneficiarioNumeroIdentificacion'] ? product['BeneficiarioNumeroIdentificacionDefault'] : product['BeneficiarioNumeroIdentificacion'],
          BeneficiarioPorcentaje: product['BeneficiarioPorcentaje'] ? product['BeneficiarioPorcentaje'] : product['BeneficiarioPorcentajeDefault'],
          BeneficiarioRelacion: product['BeneficiarioRelacion'] ? product['BeneficiarioRelacionDefault'] : product['BeneficiarioRelacion'],
          BeneficiarioFechaDeNacimiento: product['BeneficiarioFechaDeNacimiento'] ? moment(product['BeneficiarioFechaDeNacimiento']).format('DD/MM/yyyy') : product['BeneficiarioFechaDeNacimientoDefault'] ?  moment(product['BeneficiarioFechaDeNacimientoDefault']).format('DD/MM/yyyy') : '',
          numBen: product['numBen'],
        }
      })
      break;

    case 'F-BD':
    case 'ParaSuBienestar':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'F-BD',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'AUTO',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          BeneficiarioFechaDeNacimiento: '',
          BeneficiarioNombreCompleto: product['BeneficiarioNombreCompleto'] ? product['BeneficiarioNombreCompleto'] : product['BeneficiarioNombre1'] + ' ' + product['BeneficiarioApellido'],
          BeneficiarioNumeroIdentificacion: '',
          BeneficiarioPorcentaje: '',
          BeneficiarioRelacion: '',
          BeneficiarioTipoIdentificacion: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          CuponMonto: product['CuponPorcentaje'],
          CuponPorcentaje: product['CuponPorcentaje'],
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
          OriginalQuoteRef: product['OriginalQuoteRef']
        }
      })
      break;

    case 'ParaSuBienestarDesniveladoBeneficiarios':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          numOa: product['Index'],
          Cotizacion: product['QuoteRef'],
          Poliza: getPolicyByQuote(product['QuoteRef']),
          BeneficiarioNombreCompleto: product['BeneficiarioNombreCompleto'] ? product['BeneficiarioNombreCompleto'] : product['BeneficiarioNombre1'] + ' ' + product['BeneficiarioApellido'],
          BeneficiarioTipoIdentificacion: product['BeneficiarioTipoIdentificacion'] ? product['BeneficiarioTipoIdentificacionDefault'] : product['BeneficiarioTipoIdentificacion'],
          BeneficiarioNumeroIdentificacion: product['BeneficiarioNumeroIdentificacion'] ? product['BeneficiarioNumeroIdentificacionDefault'] : product['BeneficiarioNumeroIdentificacion'],
          BeneficiarioPorcentaje: product['BeneficiarioPorcentaje'] ? product['BeneficiarioPorcentaje'] : product['BeneficiarioPorcentajeDefault'],
          BeneficiarioRelacion: product['BeneficiarioRelacion'] ? product['BeneficiarioRelacionDefault'] : product['BeneficiarioRelacion'],
          BeneficiarioFechaDeNacimiento: product['BeneficiarioFechaDeNacimiento'] ? moment(product['BeneficiarioFechaDeNacimiento']).format('DD/MM/yyyy') : product['BeneficiarioFechaDeNacimientoDefault'] ?  moment(product['BeneficiarioFechaDeNacimientoDefault']).format('DD/MM/yyyy') : '',
          numBen: product['numBen'],
        }
      })
      break;

    case 'F-BD':
    case 'ParaSuBienestarNivelado':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'F-BD',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'AUTO',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreoContacto'] || '',
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['AgenteDomicilioSector'] || '',
          AgenteIdentificacion: product['AgenteIdentificacion'] || '',
          AgenteNombre1: product['AgenteNombre1'] || '',
          AgenteNombre2: product['AgenteNombre2'] || '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'] || '',
          ApellidoAsegurado: product['ClienteApellidos'] || product['ClienteApellidoTarjetaCredito'] || '',
          AzureId: '',
          BeneficiarioFechaDeNacimiento: '',
          BeneficiarioNombreCompleto: product['BeneficiarioNombreCompleto'] ? product['BeneficiarioNombreCompleto'] : product['BeneficiarioNombre1'] + ' ' + product['BeneficiarioApellido'],
          BeneficiarioNumeroIdentificacion: '',
          BeneficiarioPorcentaje: '',
          BeneficiarioRelacion: '',
          BeneficiarioTipoIdentificacion: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellidoMaterno'] || product['ClienteApellido2'] || '',
          ClienteApellidoPaterno: product['ClienteApellidoPaterno'] || product['ClienteApellido1'] || '',
          ClienteApellidoTarjetaCredito: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteApellidos: product['ClienteApellidoTarjetaCredito'] ? product['ClienteApellidoTarjetaCredito'] : product['ClienteApellidoPaterno'] ? product['ClienteApellidoPaterno'] + ' ' + product['ClienteApellidoMaterno'] : '',
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' || null ? product['ClienteCedula'] || product['ClienteCedulaLlamarAPI'] || product['ClienteCedulaEstado'] || product['CedulaClienteSiniestro'] || product['CedulaTutorSiniestroDefault'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteConfirmacionNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          ClienteCorreo: product['ClienteCorreo'] || product['ClienteCorreoFinal'] || '',
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          ClienteDomicilioSector: product['ClienteDomicilioSector'] || '',
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'Otros',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'] || '',
          ClienteNombres: product['ClienteNombres'] || product['ClienteNombreTarjetaCredito'] || '',
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporte'] : '',
          ClientePerfil: product['ClientePerfil'] || '',
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferido: product['ClienteReferido'] == 'Yes' ? 'Si' : 'No',
          ClienteReferidoDesc: product['PromotionalCode'] ? refRegExp.test(product['PromotionalCode']) ? '02' : '01' : '',
          ClienteTelefono: product['ClienteTelefonoFinal'] || '',
          CodigoPromocional: product['PromotionalCodeDefault'] || '',
          CompaniaCorretaje: product['CompaniaCorretaje'] || '',
          CuponMonto: product['CuponPorcentaje'],
          CuponPorcentaje: product['CuponPorcentaje'],
          Discount: product['Discount'] || '',
          DiscountType: product['DiscountType'] || '',
          DocumentoTipo: product['DocumentoTipo'] || '',
          EdadAsegurado: product['ClienteNacimiento'] ? moment().diff(moment(product['ClienteNacimiento']), 'years') : 0,
          EndosoCesion: product['EndosoCesion'] ? product['EndosoCesion'] == 'Yes' ? 'Si' : 'No' : '',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          FechaInicioInspeccion: product['FechaInicioInspeccion'] ? moment(product['FechaInicioInspeccion']).format('DD/MM/yyyy') : '',
          FechaNacimiento: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FechaNacimiento2: product['ClienteNacimiento'] ? moment(product['ClienteNacimiento']).format('DD/MM/yyyy') : product['ClienteNacimiento2'] ? moment(product['ClienteNacimiento2']).format('DD/MM/yyyy') : '',
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: product['IF_EmailEjecutivo'] || '',
          IF_NombreEjecutivo: product['IF_NombreEjecutivo'] || '',
          IF_NumeroEjecutivo: product['IF_NumeroEjecutivo'] || '',
          IF_RNC: product['IF_RNC'] || '',
          IF_SucursalFinanciera: product['IF_SucursalFinanciera'] || '',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: product['InstitucionFinanciera'] || '',
          NombreInstitucion: product['InstitucionFinanciera'] || '',
          Pago_Estatus: product['Pago_Estatus'] || '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          SumaAsegurada: product['SumaAsegurada'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: 'Cancelada',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
          OriginalQuoteRef: product['OriginalQuoteRef']
        }
      })
      break;

    case 'ParaSuBienestarNiveladoBeneficiarios':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          numOa: product['Index'],
          Cotizacion: product['QuoteRef'],
          Poliza: getPolicyByQuote(product['QuoteRef']),
          BeneficiarioNombreCompleto: product['BeneficiarioNombreCompleto'] ? product['BeneficiarioNombreCompleto'] : product['BeneficiarioNombre1'] + ' ' + product['BeneficiarioApellido'],
          BeneficiarioTipoIdentificacion: product['BeneficiarioTipoIdentificacion'] ? product['BeneficiarioTipoIdentificacionDefault'] : product['BeneficiarioTipoIdentificacion'],
          BeneficiarioNumeroIdentificacion: product['BeneficiarioNumeroIdentificacion'] ? product['BeneficiarioNumeroIdentificacionDefault'] : product['BeneficiarioNumeroIdentificacion'],
          BeneficiarioPorcentaje: product['BeneficiarioPorcentaje'] ? product['BeneficiarioPorcentaje'] : product['BeneficiarioPorcentajeDefault'],
          BeneficiarioRelacion: product['BeneficiarioRelacion'] ? product['BeneficiarioRelacionDefault'] : product['BeneficiarioRelacion'],
          BeneficiarioFechaDeNacimiento: product['BeneficiarioFechaDeNacimiento'] ? moment(product['BeneficiarioFechaDeNacimiento']).format('DD/MM/yyyy') : product['BeneficiarioFechaDeNacimientoDefault'] ?  moment(product['BeneficiarioFechaDeNacimientoDefault']).format('DD/MM/yyyy') : '',
          numBen: product['numBen'],
        }
      })
      break;

    case 'B-VC':
    case 'VidaCredito':
      console.log(productData[productData.length - 1])
      return _.map(productData, product => {
        return {
          codprod: 'B-VC',
          codPlan: '001',
          revPlan: '001',
          codRamo: 'SDH',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'LLAMATIVA',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          ActividadDeportePeligroso: product['ActividadDeportePeligroso'] == 'Yes' ? 'Si' : product['ActividadDeportePeligroso'] == 'Si' ? 'Si' : 'No',
          AgenteCorreo: product['ClienteCorreo'] || product['AgentGroupEmail'] || product['SalespersonEmail'] || product['AgenteCorreoContacto'],
          AgenteCorreoContacto: product['AgenteCorreoContacto'] || product['AgentGroupEmail'] || product['SalespersonEmail'] || product['ClienteCorreo'],
          AgenteDomicilioCalle: product['ClienteDomicilioCalle'] || '',
          AgenteDomicilioEdificio: product['ClienteDomicilioEdificio'] || '',
          AgenteDomicilioMunicipio: product['ClienteDomicilioMunicipio'] || '',
          AgenteDomicilioProvincia: product['ClienteDomicilioProvincia'] || '',
          AgenteDomicilioSector: product['ClienteDomicilioSector'] || '',
          AgenteIdentificacion: product['ClienteCedula'] || '',
          AgenteNombre1: product['ClienteNombre1'],
          AgenteNombre2: '',
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['ClienteTelefono'],
          ApellidoAsegurado: product['ClienteApellido1QA'] ? product['ClienteApellido1QA'] + ' ' + product['ClienteApellido2QA'] : product['FirstLastNameJCE'] ? product['FirstLastNameJCE'] + ' ' + product['SecondLastNameJCE'] : '',
          AseguradoEmbarazo: product['AseguradoEmbarazo'] == 'Yes' ? 'Si' : product['AseguradoEmbarazo'] == 'Si' ? 'Si' : 'No',
          AzureId: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellido2TMPX'] ? product['ClienteApellido2TMPX'] : product['ClienteApellido2TMP'] ? product['ClienteApellido2TMP'] : product['ClienteApellido2Pasaporte'] ? product['ClienteApellido2Pasaporte'] : '',
          ClienteApellidoPaterno: product['ClienteApellido1TMPX'] ? product['ClienteApellido1TMPX'] : product['ClienteApellido1TMP'] ? product['ClienteApellido1TMP'] : product['ClienteApellido1Pasaporte'] ? product['ClienteApellido1Pasaporte'] : '',
          ClienteApellidoTarjetaCredito: product['ClienteApellido1TMPX'] ? product['ClienteApellido1TMPX'] + ' ' + product['ClienteApellido1TMPX'] : product['ClienteApellido1TMP'] ? product['ClienteApellido1TMP'] + ' ' + product['ClienteApellido1TMP'] : product['ClienteApellido1Pasaporte'] ? product['ClienteApellido1Pasaporte'] + ' ' + product['ClienteApellido2Pasaporte'] : '',
          ClienteApellidos: product['ClienteApellido1TMPX'] ? product['ClienteApellido1TMPX'] + ' ' + product['ClienteApellido1TMPX'] : product['ClienteApellido1TMP'] ? product['ClienteApellido1TMP'] + ' ' + product['ClienteApellido1TMP'] : product['ClienteApellido1Pasaporte'] ? product['ClienteApellido1Pasaporte'] + ' ' + product['ClienteApellido2Pasaporte'] : '',
          ClienteCedula: product['DocumentoTipo'] || product['DocumentoTipoTMP'] == 'Cédula' ? product['ClienteCedulaTMP'] || product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: '',
          ClienteConfirmacionNacimiento: moment(product['ClienteNacimientoTMP']).format('DD/MM/yyyy'),
          ClienteCorreo: product['ClienteCorreoTMP'],
          ClienteDiabetes: product['ClienteDiabetes'] == 'Yes' ? 'Si' : product['ClienteDiabetes'] == 'Si' ? 'Si' : 'No',
          ClienteDomicilioCalle: '',
          ClienteDomicilioCiudad: '',
          ClienteDomicilioEdificio: '',
          ClienteDomicilioMunicipio: '',
          ClienteDomicilioProvincia: '',
          ClienteDomicilioSector: '',
          ClienteEstatura1: product['ClienteEstatura1'],
          ClienteEstatura2: product['ClienteEstatura2'],
          ClienteEstaturaUnidad: product['ClienteEstaturaUnidad'],
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'O',
          ClienteHipertension: product['ClienteHipertension'] == 'Yes' ? 'Si' : product['ClienteHipertension'] == 'Si' ? 'Si' : 'No',
          ClienteNombreTarjetaCredito: product['ClienteNombre1TMP'] || product['ClienteNombresPasaporte'],
          ClienteNombres: product['ClienteNombre1TMP'] || product['ClienteNombresPasaporte'],
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporteDefault'] : product['ClientePasaporteDefault'] != '---------' ? product['ClientePasaporteDefault'] : product['ClientePasaporteQQ'] && product['ClientePasaporteQQ'] != '---------' ? product['ClientePasaporteQQ'] : '',
          ClientePerfil: product['ClientePerfil'],
          ClientePeso: product['ClientePeso'],
          ClientePesoUnidad: product['ClientePesoUnidad'],
          ClientePreguntasCovid: product['ClientePreguntasCovid'],
          ClienteRNCRequerido: '',
          ClienteReferido: '',
          ClienteReferidoDesc: '',
          ClienteTelefono: product['ClienteTelefonoTMP'],
          Codeudor: product['Codeudor'] == 'Yes' ? '02' : product['Codeudor'] == 'Si' ? '02' : '01',
          CodeudorActividadDeportePeligroso: product['CodeudorActividadDeportePeligroso'] == 'Yes' ? 'Si' : product['CodeudorActividadDeportePeligroso'] == 'Si' ? 'Si' : 'No',
          CodeudorApellidos: product['CodeudorApellidos'] && product['CodeudorApellidos'] != '---------' ? product['CodeudorApellidos'] : '',
          CodeudorCedula: product['CodeudorCedula'],
          CodeudorDiabetes: product['CodeudorDiabetes'],
          CodeudorDocumentoTipo: product['CodeudorDocumentoTipo'],
          CodeudorEnfermedadesCatastroficas: product['CodeudorEnfermedadesCatastroficas'],
          CodeudorEstatura1: product['CodeudorEstatura1'],
          CodeudorEstatura2: product['CodeudorEstatura2'],
          CodeudorEstaturaUnidad: product['CodeudorEstaturaUnidad'],
          CodeudorHipertension: product['CodeudorHipertension'],
          CodeudorNombre: product['CodeudorNombresDefault'] || product['CodeudorNombresPasaporte'],
          CodeudorNombreActividadDeportePeligroso: product['CodeudorNombreActividadDeportePeligroso'],
          CodeudorNombreCompleto: product['CodeudorNombreCompleto'] ? product['CodeudorNombreCompleto'] != '---------' ? product['CodeudorNombreCompleto'] : '' : '',
          CodeudorNombreEnfermedadesCatastroficas: product['CodeudorNombreEnfermedadesCatastroficas'],
          CodeudorPasaporte: product['CodeudorPasaporte'] || product['CodeudorPasaporteQQ'],
          CodeudorPerfil: product['CodeudorPerfil'],
          CodeudorPeso: product['CodeudorPeso'],
          CodeudorPesoUnidad: product['CodeudorPeso'] ? product['CodeudorPesoUnidad'] : '',
          CodigoPromocional: product['PromotionalCode'],
          CompaniaCorretaje: '',
          CuponMonto: '',
          CuponPorcentaje: '',
          DeudorEstaturaCondicionado: product['DeudorEstaturaCondicionado'],
          DeudorPesoCondicionado: product['DeudorPesoCondicionado'],
          Discount: product['Discount'],
          DiscountType: product['DiscountType'],
          DocumentoTipo: product['DocumentoTipoTMP'],
          EdadAsegurado: product['ClienteNacimientoTMP'] ? moment().diff(moment(product['ClienteNacimientoTMP']), 'years') : '',
          EndosoCesion: '',
          EnfermedadesCatastroficas: product['EnfermedadesCatastroficas'] == 'Yes' ? 'Si' : product['EnfermedadesCatastroficas'] == 'Si' ? 'Si' : 'No',
          EstadoCivilAsegurado: 'S',
          EstadoCivilAsegurado2: 'S',
          ExtraPrima: product['ExtraPrima'],
          FechaNacimiento: moment(product['ClienteNacimientoTMP']).format('DD/MM/yyyy'),
          FechaNacimiento2: moment(product['ClienteNacimientoTMP']).format('DD/MM/yyyy'),
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FormularioDeSolicitud: product['FormularioDeSolicitud'] && product['FormularioDeSolicitud'] != '{}' && product['FormularioDeSolicitud'] != '---------' ? product['FormularioDeSolicitud'] : ''
          ,
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'Hombre' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: '',
          IF_NombreEjecutivo: '',
          IF_NumeroEjecutivo: '',
          IF_RNC: '',
          IF_SucursalFinanciera: '',
          IncluyeDesempleo: product['CoberturaDesempleo'] == 'Yes' ? 'Si' : product['CoberturaDesempleo'] == 'Si' ? 'Si' : 'No',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          NombreActividadDeportePeligroso: product['NombreActividadDeportePeligroso'],
          NombreAsegurado: product['ClienteNombre1TMP'] || product['ClienteNombresPasaporte'],
          NombreEnfermedadesCatastroficas: product['NombreEnfermedadesCatastroficas'],
          NombreInstitucion: product['NombreInstitucion'],
          Pago_Estatus: product['Pago_Estatus'],

          PlazoPrestamo: product['PlazoSeguroNumerico'],
          SexoAsegurado: product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : 'O',
          SumaAsegurada: product['SumaAsegurada'],
          TipoSolicitantePrestamo: product['Codeudor'] == 'Yes' ? '02' : product['Codeudor'] == 'Si' ? '02' : '01',
          TrabajaEnSectorPublico: product['TrabajaEnSectorPublico'] == 'Yes' ? 'Si' : 'No',

          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          TipoVehiculo: product['AutoTipo'] == 'AUTO' ? '01' : product['AutoTipo'] == 'CAMIONETA' ? '02' : product['AutoTipo'] == 'SUV' ? '03' : product['AutoTipo'] == 'VAN' ? '04' : '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;

    case 'A-EE':
    case 'EquiposElectronicos':
      console.log(productData[productData.length - 1])
      return _.map(productData, product => {
        return {
          codprod: 'A-EE',
          codPlan: "001",
          revPlan: "001",
          codRamo: "EQEL",
          codMoneda: "RD",
          codUsr: "externo112",
          tipoPrima: 'UNIT',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'] || product['PrimaBruta'],
          AgenteCorreo: product['AgenteCorreo'],
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'],
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'],
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'],
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'],
          AgenteDomicilioSector: product['AgenteDomicilioSector'],
          AgenteIdentificacion: product['AgenteIdentificacion'],
          AgenteNombre1: product['AgenteNombre1'],
          AgenteNombre2: product['AgenteNombre2'],
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : product['AgenteRNCRequerido'] == 'TRUE' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'],
          AnioFabricacion: '',
          AzureId: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellido2'],
          ClienteApellidoPaterno: product['ClienteApellido1'],
          ClienteApellidoTarjetaCredito: product['ClienteApellido1'] ? product['ClienteApellido1'] : product['ClienteApellido1Pasaporte'] + ' ' + product['ClienteApellido2Pasaporte'],
          ClienteApellidos: product['ClienteApellido1'] ? product['ClienteApellido1'] : product['ClienteApellido1Pasaporte'] + ' ' + product['ClienteApellido2Pasaporte'],
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'],
          ClienteConfirmacionNacimiento: moment(product['ClienteNacimiento2']).format('DD/MM/yyyy'),
          ClienteCorreo: product['ClienteCorreoQQ'],
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'],
          ClienteDomicilioCiudad: product['ClienteDomicilioCiudad'],
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'],
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'],
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'],
          ClienteDomicilioSector: product['ClienteDomicilioSector'],
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'O',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'],
          ClienteNombres: product['ClienteNombre1'] || product['ClienteNombresPasaporte'],
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporteDefault'] : product['ClientePasaporteDefault'] != '---------' ? product['ClientePasaporteDefault'] : '',
          ClientePerfil: product['ClientePerfil'],
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : 'No',
          ClienteReferido: '',
          ClienteReferidoDesc: '',
          ClienteTelefono: product['ClienteTelefonoQQ'],
          CodigoPromocional: product['PromotionalCode'],
          CompaniaCorretaje: '',
          Discount: product['Discount'],
          DiscountType: product['DiscountType'],
          DocumentoTipo: product['DocumentoTipo'],
          EndosoCesion: '',
          EquipoIdentificador: '',
          EquipoImagen1: '',
          EquipoImagen2: '',
          EquipoMarca: '',
          EquipoModelo: '',
          EquipoTipoTarifa: '',
          EquipoValor: '',
          EquipoVideo: '',
          EstadoCivilAsegurado: '',
          FechaNacimiento2: moment(product['ClienteNacimiento2']).format('DD/MM/yyyy'),
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          IF_EmailEjecutivo: '',
          IF_NombreEjecutivo: '',
          IF_NumeroEjecutivo: '',
          IF_RNC: '',
          IF_SucursalFinanciera: '',
          Iniciodevigencia: '',
          InstitucionFinanciera: '',
          MiEquipoTipo: '',
          NombreInstitucion: '',
          Pago_Estatus: '',
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'] || '',
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'] || '',
          PepOtroNombre: product['PepOtroNombre'] || '',
          PepOtroRelacion: product['PepOtroRelacion'] || '',
          PepValidacion: product['PepValidacion'] == 'Yes' ? 'Si' : product['PepValidacion'] == 'Si' ? 'Si' : 'No',
          SitePortal: product['SitePortal'] || '',
          VendedorID: product['VendedorID'] || '',
          pago_AutorizacionID: product['pago_AutorizacionID'] || '',
          pago_FormaPagoID: product['pago_FormaPagoID'] || '',
          pago_IPPID: product['pago_IPPID'] || '',
          pago_ReservaID: product['pago_ReservaID'] || '',
          pago_ResultadoID: product['pago_ResultadoID'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'] || '',
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
          Cotizacion: product['OriginalQuoteRef']
        }
      })
      break;

    case 'A-EE-LISTADO':
    case 'EquiposElectronicosListado':
      console.log(productData[productData.length - 1])
      return _.map(productData, product => {
        return {
          Cotizacion: product['QuoteRef'],
          Poliza: getPolicyByQuote(product['QuoteRef']),
          AnioFabricacion: product['AnioFabricacion'],
          EquipoIdentificador: product['EquipoIdentificador'],
          EquipoImagen1: product['EquipoImagen1'],
          EquipoImagen2: product['EquipoImagen2'],
          EquipoVideo: product['EquipoVideo'],
          EquipoMarca: product['EquipoMarca'],
          EquipoModelo: product['EquipoModelo'],
          descripcionBienAsegurado: product['EquipoMarca'] ? product['EquipoTipo'] + ' ' + product['EquipoMarca'] + ' ' + product['EquipoModelo'] : product['EquipoTipo'],
          DescripcionObjetoAsegurado: product['EquipoMarca'] ? product['EquipoTipo'] + ' ' + product['EquipoMarca'] + ' ' + product['EquipoModelo'] : product['EquipoTipo'],
          EquipoTipo: product['EquipoTipo'],
          EquipoValor: product['EquipoValor'],
          SumaAsegurada: product['EquipoValor'],
          IndexMultiItems: product['IndexMultiItems'],
          MiEquipoTipo: product['EquipoTipo'],
          numOa: product['IndexMultiItems'],
          EquipoTipoTarifa: product['EquipoValorDefault']
        }
      })
      break;

    case 'FM-A':
    case 'ParaTuMejorAmigo':
      console.log(productData[0])
      return _.map(productData, product => {
        return {
          codprod: 'F-MA',
          codPlan: product['SeguroPlan'] == 'MegaCan' ? '03' : product['SeguroPlan'] == 'SuperCan' ? '02' : '01',
          revPlan: '001',
          codRamo: 'SMAS',
          codMoneda: 'RD',
          codUsr: 'externo112',
          tipoPrima: 'UNIT',
          tipoPropuesta: 'MIGRACION',
          fecIniVigPropuesta: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          fecFinVigPropuesta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          descripcionBienAsegurado: product['PolicyNumber'],
          PrimaBruta: product['PrimaBrutaSeleccionada'],
          AgenteCorreo: product['AgenteCorreo'],
          AgenteDomicilioCalle: product['AgenteDomicilioCalle'],
          AgenteDomicilioEdificio: product['AgenteDomicilioEdificio'],
          AgenteDomicilioMunicipio: product['AgenteDomicilioMunicipio'],
          AgenteDomicilioProvincia: product['AgenteDomicilioProvincia'],
          AgenteDomicilioSector: product['AgenteDomicilioSector'],
          AgenteIdentificacion: product['AgenteIdentificacion'],
          AgenteNombre1: product['AgenteNombre1'],
          AgenteNombre2: product['AgenteNombre2'],
          AgenteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : product['AgenteRNCRequerido'] == 'AgenteRNCRequerido' ? 'Si' : 'No',
          AgenteTelefono: product['AgenteTelefono'],
          AzureId: '',
          CertificadoVigenciaDesde: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          CertificadoVigenciaHasta: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          ClienteApellidoMaterno: product['ClienteApellido2'],
          ClienteApellidoPaterno: product['ClienteApellido1'],
          ClienteApellidoTarjetaCredito: product['ClienteApellido1'] ? product['ClienteApellido1'] : product['ClienteApellido1Pasaporte'] + ' ' + product['ClienteApellido2Pasaporte'],
          ClienteApellidos: product['ClienteApellido1'] ? product['ClienteApellido1'] : product['ClienteApellido1Pasaporte'] + ' ' + product['ClienteApellido2Pasaporte'],
          ClienteCedula: product['DocumentoTipo'] == 'Cédula' ? product['ClienteCedula'] : '',
          ClienteComprobanteFiscal: product['ClienteRNCRequerido'],
          ClienteConfirmacionNacimiento: moment(product['ClienteNacimiento2']).format('DD/MM/yyyy'),
          ClienteCorreo: product['ClienteCorreoQQ'],
          ClienteDomicilioCalle: product['ClienteDomicilioCalle'],
          ClienteDomicilioCiudad: product['ClienteDomicilioCiudad'],
          ClienteDomicilioEdificio: product['ClienteDomicilioEdificio'],
          ClienteDomicilioMunicipio: product['ClienteDomicilioMunicipio'],
          ClienteDomicilioProvincia: product['ClienteDomicilioProvincia'],
          ClienteDomicilioSector: product['ClienteDomicilioSector'],
          ClienteGenero: product['ClienteGeneroPasaporte'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroPasaporte'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroPasaporte'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroJCE'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroJCE'] == 'Mujer' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Masculino' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Hombre' ? 'Hombre' : product['ClienteGeneroTMP'] == 'Femenino' ? 'Mujer' : product['ClienteGeneroTMP'] == 'Mujer' ? 'Mujer' : product['ClienteGenero'] == 'Masculino' ? 'Hombre' : product['ClienteGenero'] == 'Hombre' ? 'Hombre' : product['ClienteGenero'] == 'Femenino' ? 'Mujer' : product['ClienteGenero'] == 'Mujer' ? 'Mujer' : 'O',
          ClienteNombreTarjetaCredito: product['ClienteNombreTarjetaCredito'],
          ClienteNombres: product['ClienteNombre1'] || product['ClienteNombresPasaporte'],
          ClientePasaporte: product['DocumentoTipo'] == 'Pasaporte' ? product['ClientePasaporteDefault'] : product['ClientePasaporteDefault'] != '---------' ? product['ClientePasaporteDefault'] : '',
          ClientePerfil: product['ClientePerfil'],
          ClienteRNCRequerido: product['ClienteRNCRequerido'] == 'Yes' ? 'Si' : product['ClienteRNCRequerido'] == 'Si' ? 'Si' : 'No',
          ClienteReferido: '',
          ClienteReferidoDesc: '',
          ClienteTelefono: product['ClienteTelefonoQQ'],
          CodigoPromocional: product['PromotionalCode'],
          CompaniaCorretaje: '',
          Discount: product['Discount'],
          DiscountType: product['DiscountType'],
          DocumentoTipo: product['DocumentoTipo'],
          EdadMascota: product['MascotaEdad'],
          EndosoCesion: '',
          EstadoCivilAsegurado: 'S',
          FechaNacimiento2: moment(product['ClienteNacimiento2']).format('DD/MM/yyyy'),
          FindeVigencia: moment(product['PolizaFin']).format('DD/MM/yyyy'),
          FraccionamientoPago: product['PagosFrecuenciaDefault'] == 'Mensual' ? 'M' : product['PagosFrecuenciaDefault'] == 'Anual' ? 'A' : 'PU',
          FrenteMascotaImageURL: product['FrenteMascotaImageURL'],
          IF_EmailEjecutivo: '',
          IF_NombreEjecutivo: '',
          IF_NumeroEjecutivo: '',
          IF_RNC: '',
          IF_SucursalFinanciera: '',
          IndMascotaCasera: product['MascotaTipo'] == 'Yes' ? 'SI' : 'NO',
          Iniciodevigencia: moment(product['PolizaInicio']).format('DD/MM/yyyy'),
          InstitucionFinanciera: '',
          MascotaAnioNacimiento: product['MascotaAnioNacimiento'],
          NombreInstitucion: '',
          NombreMascota: product['MascotaNombre'],
          Pago_Estatus: product['Pago_Estatus'],
          Pep: product['Pep'] == 'Yes' ? 'Si' : product['Pep'] == 'Si' ? 'Si' : 'No',
          PepClienteCargo: product['PepClienteCargo'],
          PepClienteCargoFinal: product['Pep'] == 'Yes' ? product['PepClienteCargoFinal'] : '',
          PepOtroCargo: product['PepOtroCargo'],
          PepOtroNombre: product['PepOtroNombre'],
          PepOtroRelacion: product['PepOtroRelacion'],
          PepValidacion: product['PepValidacion'],
          RasaMascota: product['MascotaRaza'],
          SitePortal: product['SitePortal'],
          VendedorID: '',
          pago_AutorizacionID: product['pago_AutorizacionID'],
          pago_FormaPagoID: product['pago_FormaPagoID'],
          pago_IPPID: product['pago_IPPID'],
          pago_ReservaID: product['pago_ReservaID'],
          pago_ResultadoID: product['pago_ResultadoID'],
          pago_ResultadoMensaje: product['pago_ResultadoMensaje'],
          Estado: product['IsCancelled'] ? 'Cancelada' : 'Activa',
          FechaPrimeraEmision: moment(product['PolicyOriginalSaleDate']).format('DD/MM/yyyy'),
        }
      })
      break;


  }
}


//Tables Directions DB

//Auto Comprensivo
// let bacTable1 = '[dbint_251].[dbint_251_1642_MigracionAutoComprensivoParte1]';
let bacTable2 = '[dbint_251].[dbint_251_1646_MigracionAutoComprensivoParte2]';
let bacTable3 = '[dbint_251].[dbint_251_1647_MigracionAutoComprensivoParte3]';
let bacTable4 = '[dbint_251].[dbint_251_1648_MigracionAutoComprensivoParte4]';
let bacTable5 = '[dbint_251].[dbint_251_1649_MigracionAutoComprensivoParte5]';
let bacTable6 = '[dbint_251].[dbint_251_1650_MigracionAutoComprensivoParte6]';
let bacTable7 = '[dbint_251].[dbint_251_1651_MigracionAutoComprensivoParte7]';
let bacTable8 = '[dbint_251].[dbint_251_1652_MigracionAutoComprensivoParte8]';
let bacTable9 = '[dbint_251].[dbint_251_1653_MigracionAutoComprensivoParte9]';

//Para Tu Auto
// let apaTable1 = '[dbint_251].[dbint_251_1494_MigracionParaTuAutoParte1]';
let apaTable2 = '[dbint_251].[dbint_251_1495_MigracionParaTuAutoParte2]';
let apaTable3 = '[dbint_251].[dbint_251_1671_MigracionParaTuAutoParte3]';
let apaTable4 = '[dbint_251].[dbint_251_1672_MigracionParaTuAutoParte4]';
let apaTable5 = '[dbint_251].[dbint_251_1673_MigracionParaTuAutoParte5]';
let apaTable6 = '[dbint_251].[dbint_251_1674_MigracionParaTuAutoParte6]';
let apaTable7 = '[dbint_251].[dbint_251_1675_MigracionParaTuAutoParte7]';
let apaTable8 = '[dbint_251].[dbint_251_1676_MigracionParaTuAutoParte8]';
let apaTable9 = '[dbint_251].[dbint_251_1677_MigracionParaTuAutoParte9]';

//Por Lo Que Conduces
let akmTable2 = '[dbint_251_1497_MigracionPorLoQueConducesParte2]';
let akmTable3 = '[dbint_251_1721_MigracionPorLoQueConducesParte3]';
let akmTable4 = '[dbint_251_1722_MigracionPorLoQueConducesParte4]';
let akmTable5 = '[dbint_251_1723_MigracionPorLoQueConducesParte5]';
let akmTable6 = '[dbint_251_1724_MigracionPorLoQueConducesParte6]';
let akmTable7 = '[dbint_251_1725_MigracionPorLoQueConducesParte7]';
let akmTable8 = '[dbint_251_1726_MigracionPorLoQueConducesParte8]';
let akmTable9 = '[dbint_251_1727_MigracionPorLoQueConducesParte9]';
let akmTable10 = '[dbint_251_1728_MigracionPorLoQueConducesParte10]';

//Perdida Total
let aptTable2 = 'dbint_251_1501_MigracionPorSiPierdesTuAutoParte2';
let aptTable3 = 'dbint_251_1736_MigracionPorSiPierdesTuAutoParte3';
let aptTable4 = 'dbint_251_1737_MigracionPorSiPierdesTuAutoParte4';
let aptTable5 = 'dbint_251_1738_MigracionPorSiPierdesTuAutoParte5';
let aptTable6 = 'dbint_251_1739_MigracionPorSiPierdesTuAutoParte6';
let aptTable7 = 'dbint_251_1740_MigracionPorSiPierdesTuAutoParte7';
let aptTable8 = 'dbint_251_1741_MigracionPorSiPierdesTuAutoParte8';
let aptTable9 = 'dbint_251_1742_MigracionPorSiPierdesTuAutoParte9';


//Por Si Chocas
let apcTable2 = 'dbint_251_1500_MigracionPorSiChocasParte2';
let apcTable3 = 'dbint_251_1729_MigracionPorSiChocasParte3';
let apcTable4 = 'dbint_251_1730_MigracionPorSiChocasParte4';
let apcTable5 = 'dbint_251_1731_MigracionPorSiChocasParte5';
let apcTable6 = 'dbint_251_1732_MigracionPorSiChocasParte6';
let apcTable7 = 'dbint_251_1733_MigracionPorSiChocasParte7';
let apcTable8 = 'dbint_251_1734_MigracionPorSiChocasParte8';
let apcTable9 = 'dbint_251_1735_MigracionPorSiChocasParte9';

//Por Si Te Enfermas
let senTable2 = 'dbint_251_1579_MigracionPorSiTeEnfermasParte2';
let senTable3 = 'dbint_251_1751_MigracionPorSiTeEnfermasParte3';
let senTable4 = 'dbint_251_1752_MigracionPorSiTeEnfermasParte4';
let senTable5 = 'dbint_251_1753_MigracionPorSiTeEnfermasParte5';
let senTable6 = 'dbint_251_1754_MigracionPorSiTeEnfermasParte6';

//Por Si Pierdes Tus Ingresos
let finTable2 = 'dbint_251_1567_MigracionPorSiPierdesTusIngresosParte2';
let finTable3 = 'dbint_251_1743_MigracionPorSiPierdesTusIngresosParte3';
let finTable4 = 'dbint_251_1744_MigracionPorSiPierdesTusIngresosParte4';
let finTable5 = 'dbint_251_1745_MigracionPorSiPierdesTusIngresosParte5';

//Emergencias Del Hogar
let fehTable2 = 'dbint_251_1573_MigracionParaTusEmergenciasDelHogarParte2';
let fehTable3 = 'dbint_251_1703_MigracionParaTusEmergenciasDelHogarParte3';
let fehTable4 = 'dbint_251_1704_MigracionParaTusEmergenciasDelHogarParte4';
let fehTable5 = 'dbint_251_1705_MigracionParaTusEmergenciasDelHogarParte5';
let fehTable6 = 'dbint_251_1706_MigracionParaTusEmergenciasDelHogarParte6';


//Para Tu Bici
let abrTable2 = 'dbint_251_1569_MigracionParaTuBiciParte2';
let abrTable3 = 'dbint_251_1678_MigracionParaTuBiciParte3';
let abrTable4 = 'dbint_251_1679_MigracionParaTuBiciParte4';
let abrTable5 = 'dbint_251_1680_MigracionParaTuBiciParte5';
let abrTable6 = 'dbint_251_1681_MigracionParaTuBiciParte6';
let abrTable7 = 'dbint_251_1682_MigracionParaTuBiciParte7';

//Para Tu Bici Reaseguro
let abrrTable2 = 'dbint_251_1570_MigracionBicicletaReaseguroPolizasParte2';
let abrrTable3 = 'dbint_251_1683_MigracionBicicletaReaseguroPolizasParte3';
let abrrTable4 = 'dbint_251_1684_MigracionBicicletaReaseguroPolizasParte4';
let abrrTable5 = 'dbint_251_1685_MigracionBicicletaReaseguroPolizasParte5';
let abrrTable6 = 'dbint_251_1686_MigracionBicicletaReaseguroPolizasParte6';
let abrrTable7 = 'dbint_251_1687_MigracionBicicletaReaseguroPolizasParte7';

//Por Si Te Accidentas
let fapTable2 = 'dbint_251_1578_MigracionPorSiTeAccidentasParte2';
let fapTable3 = 'dbint_251_1746_MigracionPorSiTeAccidentasParte3';
let fapTable4 = 'dbint_251_1747_MigracionPorSiTeAccidentasParte4';
let fapTable5 = 'dbint_251_1748_MigracionPorSiTeAccidentasParte5';
let fapTable6 = 'dbint_251_1749_MigracionPorSiTeAccidentasParte6';

//Por Si Te Accidentas Beneficarios
let fapbTable = 'dbint_251_1750_MigracionPorSiTeAccidentasBeneficiarios';

//Para Su Bienestar Desnivelado
let fbdTable2 = 'dbint_251_1656_MigracionParasuBienestarDesniveladoParte2';
let fbdTable3 = 'dbint_251_1657_MigracionParasuBienestarDesniveladoParte3';
let fbdTable4 = 'dbint_251_1658_MigracionParasuBienestarDesniveladoParte4';
let fbdTable5 = 'dbint_251_1659_MigracionParasuBienestarDesniveladoParte5';
let fbdTable6 = 'dbint_251_1660_MigracionParasuBienestarDesniveladoParte6';

//Para Su Bienestar Desnivelado Beneficarios
let fbdbTable = 'dbint_251_1663_MigracionParasuBienestarDesniveladoBeneficiarios';

//Para Su Bienestar Nivelado
let fbdnTable2 = 'dbint_251_1665_MigracionParasuBienestarNiveladoParte2';
let fbdnTable3 = 'dbint_251_1666_MigracionParasuBienestarNiveladoParte3';
let fbdnTable4 = 'dbint_251_1667_MigracionParasuBienestarNiveladoParte4';
let fbdnTable5 = 'dbint_251_1668_MigracionParasuBienestarNiveladoParte5';
let fbdnTable6 = 'dbint_251_1669_MigracionParasuBienestarNiveladoParte6';

//Para Su Bienestar Nivelado Beneficarios
let fbdnbTable = 'dbint_251_1670_MigracionParasuBienestarNiveladoBeneficiarios';

//Vida Crédito
let bvcTable1 = 'dbint_251_1580_MigracionVidaCreditoBancaSeguro1';
let bvcTable2 = 'dbint_251_1581_MigracionVidaCreditoBancaSeguro2';
let bvcTable3 = 'dbint_251_1773_MigracionVidaCreditoBancaSeguro3';
let bvcTable4 = 'dbint_251_1774_MigracionVidaCreditoBancaSeguro4';
let bvcTable5 = 'dbint_251_1775_MigracionVidaCreditoBancaSeguro5';
let bvcTable6 = 'dbint_251_1776_MigracionVidaCreditoBancaSeguro6';
let bvcTable7 = 'dbint_251_1777_MigracionVidaCreditoBancaSeguro7';
let bvcTable8 = 'dbint_251_1778_MigracionVidaCreditoBancaSeguro8';
let bvcTable9 = 'dbint_251_1779_MigracionVidaCreditoBancaSeguro9';

//Para Tus Equipos
let aeeTable2 = 'dbint_251_1572_MigracionParaTusEquiposParte2';
let aeeTable3 = 'dbint_251_1707_MigracionParaTusEquiposParte3';
let aeeTable4 = 'dbint_251_1708_MigracionParaTusEquiposParte4';
let aeeTable5 = 'dbint_251_1709_MigracionParaTusEquiposParte5';
let aeeTable6 = 'dbint_251_1710_MigracionParaTusEquiposParte6';
let aeeTable7 = 'dbint_251_1711_MigracionParaTusEquiposParte7';
let aeeTable8 = 'dbint_251_1712_MigracionParaTusEquiposParte8';
let aeeTableEquipos = 'dbint_251_1714_MigracionParaTusEquiposListadoEquipos';

//Para Tu Mejor Amigo
// let fmaTable1 = 'dbint_251_1545_MigracionParaTuMejorAmigoParte2';
let fmaTable2 = 'dbint_251_1545_MigracionParaTuMejorAmigoParte2';
let fmaTable3 = 'dbint_251_1694_MigracionParaTuMejorAmigoParte3';
let fmaTable4 = 'dbint_251_1695_MigracionParaTuMejorAmigoParte4';
let fmaTable5 = 'dbint_251_1696_MigracionParaTuMejorAmigoParte5';
let fmaTable6 = 'dbint_251_1697_MigracionParaTuMejorAmigoParte6';
let fmaTable7 = 'dbint_251_1698_MigracionParaTuMejorAmigoParte7';



//Init Functions Consulting the views in MS-SERVER


//Auto Comprensivo
// getDataFromInstadna('AutoComprensivo', [getTableData(bacTable2), getTableData(bacTable3), getTableData(bacTable4), getTableData(bacTable5), getTableData(bacTable6), getTableData(bacTable7), getTableData(bacTable8), getTableData(bacTable9)]);

//Para Tu Auto
// getDataFromInstadna('ParaTuAuto', [getTableData(apaTable2), getTableData(apaTable3), getTableData(apaTable4), getTableData(apaTable5), getTableData(apaTable6), getTableData(apaTable7), getTableData(apaTable8), getTableData(apaTable9)]);

//Por Lo Que Conduces
// getDataFromInstadna('PorLoQueConduces', [getTableData(akmTable2), getTableData(akmTable3), getTableData(akmTable4), getTableData(akmTable5), getTableData(akmTable6), getTableData(akmTable7), getTableData(akmTable8), getTableData(akmTable9), getTableData(akmTable10)]);

//Perdida Total
// getDataFromInstadna('PerdidaTotal', [getTableData(aptTable2), getTableData(aptTable3), getTableData(aptTable4), getTableData(aptTable5), getTableData(aptTable6), getTableData(aptTable7), getTableData(aptTable8), getTableData(aptTable9)]);

//Por Si Chocas
// getDataFromInstadna('PorSiChocas', [getTableData(apcTable2), getTableData(apcTable3), getTableData(apcTable4), getTableData(apcTable5), getTableData(apcTable6), getTableData(apcTable7), getTableData(apcTable8), getTableData(apcTable9)]);

//Por Si Te Enfermas
// getDataFromInstadna('PorSiTeEnfermas', [getTableData(senTable2), getTableData(senTable3), getTableData(senTable4), getTableData(senTable5), getTableData(senTable6)]);


//Por Si Pierdes Tus Ingresos
// getDataFromInstadna('PorSiPierdesTusIngresos', [getTableData(finTable2), getTableData(finTable3), getTableData(finTable4), getTableData(finTable5)]);

//Emergencias Del Hogar
// getDataFromInstadna('EmergenciasDelHogar', [getTableData(fehTable2), getTableData(fehTable3), getTableData(fehTable4), getTableData(fehTable5), getTableData(fehTable6)]);


//Para Tu Bici
// getDataFromInstadna('ParaTuBici', [getTableData(abrTable2), getTableData(abrTable3), getTableData(abrTable4), getTableData(abrTable5), getTableData(abrTable6), getTableData(abrTable7)]);

//Para Tu Bici Reaseguro
// getDataFromInstadna('ParaTuBiciReaseguro', [getTableData(abrrTable2), getTableData(abrrTable3), getTableData(abrrTable4), getTableData(abrrTable5), getTableData(abrrTable6), getTableData(abrrTable7)]);


//Por Si Te Accidentas
// getDataFromInstadna('PorSiTeAccidentas', [getTableData(fapTable2), getTableData(fapTable3), getTableData(fapTable4), getTableData(fapTable5), getTableData(fapTable6)]);

//Por Si Te Accidentas Beneficiarios
// getDataFromInstadna('PorSiTeAccidentasBeneficiarios', [getTableData(fapbTable, true)]);


//Para Su Bienestar
// getDataFromInstadna('ParaSuBienestar', [getTableData(fbdTable2), getTableData(fbdTable3), getTableData(fbdTable4), getTableData(fbdTable5), getTableData(fbdTable6)]);

//Para Su Bienestar Desnivelado Beneficiarios
// getDataFromInstadna('ParaSuBienestarDesniveladoBeneficiarios', [getTableData(fbdbTable, true)]);

//Para Su Bienestar Nivelado
// getDataFromInstadna('ParaSuBienestarNivelado', [getTableData(fbdnTable2), getTableData(fbdnTable3), getTableData(fbdnTable4), getTableData(fbdnTable5), getTableData(fbdnTable6)]);

//Para Su Bienestar Nivelado Beneficiarios
// getDataFromInstadna('ParaSuBienestarNiveladoBeneficiarios', [getTableData(fbdnbTable, true)]);

//Vida Crédito
getDataFromInstadna('VidaCredito', [getTableData(bvcTable1), getTableData(bvcTable2), getTableData(bvcTable3), getTableData(bvcTable4), getTableData(bvcTable5), getTableData(bvcTable6), getTableData(bvcTable7), getTableData(bvcTable8), getTableData(bvcTable9)]);

//Para Tus Equipos
// getDataFromInstadna('EquiposElectronicos', [ getTableData(aeeTable2), getTableData(aeeTable3), getTableData(aeeTable4), getTableData(aeeTable5), getTableData(aeeTable6), getTableData(aeeTable7), getTableData(aeeTable8)]);

//Para Tus Equipos - Listado
// getDataFromInstadna('EquiposElectronicosListado', [getTableData(aeeTableEquipos, true)]);

//Para Mejor Amigo
// getDataFromInstadna('ParaTuMejorAmigo', [getTableData(fmaTable2), getTableData(fmaTable3), getTableData(fmaTable4), getTableData(fmaTable5), getTableData(fmaTable6), getTableData(fmaTable7)]);


let generateExcel = function (data, productName) {
  data = data || [
    { "ideProp": "A-PA", "Product": "Para Tu Auto" }
  ]

  let workbook = exportData(data, productName);
  workbook.xlsx.writeFile(productName + ".xlsx");
  console.log('Done')

}

//Name sheet
const exportData = (data, sheetName) => {
  let workbook = new exceljs.Workbook()
  let sheet = workbook.addWorksheet(sheetName);
  let colums = data.reduce((acc, obj) => acc = Object.getOwnPropertyNames(obj), [])
  sheet.columns = colums.map((excel) => {
    return { header: excel, key: excel, width: 20 }
  });
  sheet.addRows(data);
  return workbook;
};


replaceAll = function (str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

escapeRegExp = function (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
