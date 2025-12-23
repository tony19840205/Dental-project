library DentalCrossClinicRules version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

codesystem "SNOMED-CT": 'http://snomed.info/sct'
codesystem "DentalProcedureCodes": 'http://example.org/fhir/dental-procedures'
codesystem "DentalDiagnosisCodes": 'http://example.org/fhir/dental-diagnosis'

// 定義牙科處置代碼
code "Extraction": '129304002' from "SNOMED-CT" display '拔牙'
code "RCT_First": 'RCT-FIRST' from "DentalProcedureCodes" display '根管第一次療程'
code "RCT": '234567' from "SNOMED-CT" display '根管治療'
code "RCT_Cleaning": 'RCT-CLEAN' from "DentalProcedureCodes" display '根管清創'
code "RCT_Filling": 'RCT-FILL' from "DentalProcedureCodes" display '根管充填'
code "Filling": '234568' from "SNOMED-CT" display '補牙'
code "Implant": 'IMPLANT' from "DentalProcedureCodes" display '植牙'
code "Crown": 'CROWN' from "DentalProcedureCodes" display '牙冠/假牙'
code "Bridge": 'BRIDGE' from "DentalProcedureCodes" display '假牙橋'
code "Periodontal_Treatment": 'PERIO-TX' from "DentalProcedureCodes" display '牙周治療'

// 定義診斷代碼
code "Mild_Caries": 'CARIES-MILD' from "DentalDiagnosisCodes" display '輕度齲齒'
code "Moderate_Caries": 'CARIES-MOD' from "DentalDiagnosisCodes" display '中度齲齒'
code "Severe_Caries": 'CARIES-SEV' from "DentalDiagnosisCodes" display '重度齲齒'
code "Pulpitis": 'PULPITIS' from "DentalDiagnosisCodes" display '牙髓炎'
code "Apical_Disease": 'APICAL-DIS' from "DentalDiagnosisCodes" display '根尖病變'

context Patient

// =============================================================================
// 🔴 R01｜已拔除牙再次被處置
// 嚴重度：🔴 高（Hard alert）
// =============================================================================
define "R01_ExtractedToothRetreated":
  [Procedure: "Extraction"] ExtractionProc
    with [Procedure] SubsequentProc
      such that SubsequentProc.bodySite ~ ExtractionProc.bodySite
        and SubsequentProc.performed.start() after ExtractionProc.performed.start()
        and SubsequentProc.code !~ "Extraction"
        and SubsequentProc.status = 'completed'
    return {
      tooth: ExtractionProc.bodySite,
      extractionDate: ExtractionProc.performed.start(),
      subsequentProcedure: SubsequentProc.code,
      subsequentDate: SubsequentProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：此牙位已於 ' + ToString(ExtractionProc.performed.start()) + ' 拔除，不應再進行治療處置'
    }

// =============================================================================
// 🔴 R02｜跨院重複記錄「根管第一次療程」
// 嚴重度：🔴 高
// =============================================================================
define "R02_DuplicateFirstRCTAcrossClinics":
  [Procedure: "RCT_First"] FirstRCT
    with [Procedure: "RCT_First"] OtherRCT
      such that FirstRCT.id != OtherRCT.id
        and FirstRCT.bodySite ~ OtherRCT.bodySite
        and FirstRCT.encounter.reference != OtherRCT.encounter.reference
        and exists([Encounter] E1 where E1.id = Last(Split(FirstRCT.encounter.reference, '/'))
          and exists([Encounter] E2 where E2.id = Last(Split(OtherRCT.encounter.reference, '/'))
            and E1.serviceProvider.reference != E2.serviceProvider.reference))
    return {
      tooth: FirstRCT.bodySite,
      currentClinic: FirstRCT.encounter,
      currentDate: FirstRCT.performed.start(),
      previousClinic: OtherRCT.encounter,
      previousDate: OtherRCT.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：此牙位已於其他院所記錄「根管第一次療程」，請確認是否為續療或重新治療'
    }

// =============================================================================
// R04｜診斷嚴重度不足以支持處置
// =============================================================================
define "R04_DiagnosisInsufficientForProcedure":
  [Procedure] RCTProcedure
    where (RCTProcedure.code ~ "RCT" 
      or RCTProcedure.code ~ "RCT_First" 
      or RCTProcedure.code ~ "RCT_Cleaning"
      or RCTProcedure.code ~ "RCT_Filling")
    with [Condition] Diagnosis
      such that Diagnosis.bodySite ~ RCTProcedure.bodySite
        and Diagnosis.code ~ "Mild_Caries"
        and not exists([Condition] SevereCondition
          where SevereCondition.bodySite ~ RCTProcedure.bodySite
            and (SevereCondition.code ~ "Pulpitis" 
              or SevereCondition.code ~ "Apical_Disease"
              or SevereCondition.code ~ "Severe_Caries"))
    return {
      procedure: RCTProcedure.code,
      tooth: RCTProcedure.bodySite,
      currentDiagnosis: Diagnosis.code,
      severity: 'ALERT',
      message: '⚠️ 注意：目前診斷為輕度齲齒，建議補登牙髓炎或根尖病變診斷以支持根管治療'
    }

// =============================================================================
// R05｜治療時序不合理（根管清創應早於根管充填）
// =============================================================================
define "R05_UnreasonableTreatmentSequence":
  [Procedure: "RCT_Cleaning"] CleaningProc
    with [Procedure: "RCT_Filling"] FillingProc
      such that FillingProc.bodySite ~ CleaningProc.bodySite
        and FillingProc.performed.start() < CleaningProc.performed.start()
    return {
      tooth: CleaningProc.bodySite,
      cleaningDate: CleaningProc.performed.start(),
      fillingDate: FillingProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：根管清創時間晚於充填，治療順序異常，應先清創再充填'
    }

// =============================================================================
// R07｜同一牙位短期內重複高頻就診
// =============================================================================
define "R07_HighFrequencyVisitsForSameTooth":
  [Procedure] Proc
    let RecentProcedures: [Procedure] RecentProc
      where RecentProc.bodySite ~ Proc.bodySite
        and RecentProc.performed.start() within 14 days of Proc.performed.start()
        and RecentProc.id != Proc.id
    where Count(RecentProcedures) >= 3
    return {
      tooth: Proc.bodySite,
      visitCount: Count(RecentProcedures) + 1,
      firstVisit: Min(RecentProcedures.performed.start()),
      lastVisit: Max(RecentProcedures.performed.start()),
      severity: 'ALERT',
      message: '⚠️ 注意：此牙位14天內已有' + ToString(Count(RecentProcedures) + 1) + '次處置，請檢視治療時間軸'
    }

// =============================================================================
// R08｜診斷存在但無任何後續處置
// =============================================================================
define "R08_DiagnosisWithoutFollowUpProcedure":
  [Condition] Diagnosis
    where (Diagnosis.code ~ "Moderate_Caries" or Diagnosis.code ~ "Severe_Caries")
      and Diagnosis.onsetDateTime before Today() - 90 days
      and not exists([Procedure] Proc
        where Proc.bodySite ~ Diagnosis.bodySite
          and Proc.performed.start() after Diagnosis.onsetDateTime)
    return {
      diagnosis: Diagnosis.code,
      tooth: Diagnosis.bodySite,
      diagnosisDate: Diagnosis.onsetDateTime,
      daysSinceDiagnosis: days between Diagnosis.onsetDateTime and Today(),
      severity: 'ALERT',
      message: '⚠️ 注意：已記錄中重度齲齒超過90天，但長期未有治療紀錄，建議追蹤或轉診'
    }

// =============================================================================
// R09｜牙位標記不一致
// =============================================================================
define "R09_InconsistentToothPosition":
  [Procedure] Proc
    let RelatedConditions: [Condition] C where C.encounter = Proc.encounter,
        RelatedImaging: [ImagingStudy] I where I.started same day as Proc.performed.start()
    where exists(RelatedConditions C where C.bodySite !~ Proc.bodySite)
       or exists(RelatedImaging I where I.bodySite !~ Proc.bodySite)
    return {
      procedureTooth: Proc.bodySite,
      conditionTeeth: distinct RelatedConditions.bodySite,
      imagingTeeth: distinct RelatedImaging.bodySite,
      severity: 'ALERT',
      message: '⚠️ 注意：影像、診斷、處置的牙位標示不一致，請統一牙位標記'
    }

// =============================================================================
// R10｜跨院既往治療未被引用
// =============================================================================
define "R10_CrossClinicHistoryNotReferenced":
  [Encounter] CurrentEncounter
    let CurrentProvider: CurrentEncounter.serviceProvider.reference,
        ExternalProcedures: [Procedure] ExtProc
          where exists([Encounter] ExtEnc 
            where ExtEnc.id = Last(Split(ExtProc.encounter.reference, '/'))
              and ExtEnc.serviceProvider.reference != CurrentProvider)
    where exists(ExternalProcedures)
      and not exists([Provenance] Prov
        where Prov.target.reference = 'Encounter/' + CurrentEncounter.id
          and exists(Prov.entity E 
            where E.what.reference in ExternalProcedures.id))
    return {
      currentEncounter: CurrentEncounter.id,
      externalProcedureCount: Count(ExternalProcedures),
      externalClinics: distinct ExternalProcedures P 
        return [Encounter] E where E.id = Last(Split(P.encounter.reference, '/'))
          return E.serviceProvider.reference,
      severity: 'ALERT',
      message: '⚠️ 注意：已取得' + ToString(Count(ExternalProcedures)) + '筆跨院既往治療，建議引用既往摘要'
    }

// =============================================================================
// R11｜植牙後又根管治療
// =============================================================================
define "R11_ImplantFollowedByRCT":
  [Procedure: "Implant"] ImplantProc
    with [Procedure: "RCT"] RCTProc
      such that RCTProc.bodySite ~ ImplantProc.bodySite
        and RCTProc.performed.start() after ImplantProc.performed.start()
        and RCTProc.status = 'completed'
    return {
      tooth: ImplantProc.bodySite,
      implantDate: ImplantProc.performed.start(),
      rctDate: RCTProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：植體無牙髓組織，不應進行根管治療，請確認牙位是否正確'
    }

// =============================================================================
// R12｜植牙後又補牙
// =============================================================================
define "R12_ImplantFollowedByFilling":
  [Procedure: "Implant"] ImplantProc
    with [Procedure: "Filling"] FillingProc
      such that FillingProc.bodySite ~ ImplantProc.bodySite
        and FillingProc.performed.start() after ImplantProc.performed.start()
        and FillingProc.status = 'completed'
    return {
      tooth: ImplantProc.bodySite,
      implantDate: ImplantProc.performed.start(),
      fillingDate: FillingProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：植體無法產生齲齒，不應進行補牙，請確認牙位是否正確'
    }

// =============================================================================
// R12B｜植牙後診斷齲齒（新增規則）
// 說明：植體為人工材料（鈦合金），不會產生齲齒
// 邏輯：只檢查植牙完成後才診斷的齲齒（植牙前有齋齒是合理的）
// 可能的正確診斷：植體周圍炎、牙周病、軟組織問題等
// =============================================================================
define "R12B_ImplantDiagnosedWithCaries":
  [Procedure: "Implant"] ImplantProc
    with [Condition] CariesCondition
      such that CariesCondition.bodySite ~ ImplantProc.bodySite
        and (CariesCondition.code ~ "Mild_Caries" 
          or CariesCondition.code ~ "Moderate_Caries" 
          or CariesCondition.code ~ "Severe_Caries")
        and CariesCondition.onsetDateTime after ImplantProc.performed.start()
    return {
      tooth: ImplantProc.bodySite,
      implantDate: ImplantProc.performed.start(),
      diagnosisDate: CariesCondition.onsetDateTime,
      diagnosisType: CariesCondition.code,
      severity: 'ALERT',
      message: '⚠️ 注意：植體為鈦合金材料無法產生齲齒，請確認診斷是否正確（建議改為：植體周圍炎、牙周病等）'
    }

// =============================================================================
// R13｜根管充填後又做根管第一次療程
// =============================================================================
define "R13_RCTFillingFollowedByFirstRCT":
  [Procedure: "RCT_Filling"] FillingProc
    with [Procedure: "RCT_First"] FirstProc
      such that FirstProc.bodySite ~ FillingProc.bodySite
        and FirstProc.performed.start() after FillingProc.performed.start()
        and FirstProc.status = 'completed'
    return {
      tooth: FillingProc.bodySite,
      fillingDate: FillingProc.performed.start(),
      firstRCTDate: FirstProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：根管充填完成後又記錄根管第一次療程，治療順序異常或為重新治療，請確認'
    }

// =============================================================================
// R14｜牙冠完成後又補牙
// =============================================================================
define "R14_CrownFollowedByFilling":
  [Procedure: "Crown"] CrownProc
    with [Procedure: "Filling"] FillingProc
      such that FillingProc.bodySite ~ CrownProc.bodySite
        and FillingProc.performed.start() after CrownProc.performed.start()
        and FillingProc.status = 'completed'
    return {
      tooth: CrownProc.bodySite,
      crownDate: CrownProc.performed.start(),
      fillingDate: FillingProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：全瓷冠/牙冠完成後無法在冠內補牙，請確認是否為牙冠邊緣或其他牙位'
    }

// =============================================================================
// R15｜先做牙冠才做根管治療（順序錯誤）
// =============================================================================
define "R15_CrownBeforeRCT":
  [Procedure: "Crown"] CrownProc
    with [Procedure: "RCT"] RCTProc
      such that RCTProc.bodySite ~ CrownProc.bodySite
        and RCTProc.performed.start() after CrownProc.performed.start()
        and days between CrownProc.performed.start() and RCTProc.performed.start() <= 90
    return {
      tooth: CrownProc.bodySite,
      crownDate: CrownProc.performed.start(),
      rctDate: RCTProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：通常應先完成根管治療再製作牙冠，請確認治療順序是否正確'
    }

// =============================================================================
// R16｜根管清創早於根管第一次療程
// =============================================================================
define "R16_CleaningBeforeFirstRCT":
  [Procedure: "RCT_Cleaning"] CleaningProc
    where not exists([Procedure: "RCT_First"] FirstProc
      where FirstProc.bodySite ~ CleaningProc.bodySite
        and FirstProc.performed.start() before CleaningProc.performed.start()
        and FirstProc.status = 'completed')
    return {
      tooth: CleaningProc.bodySite,
      cleaningDate: CleaningProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：根管清創前應先有根管第一次療程記錄，請確認治療順序'
    }

// =============================================================================
// R17｜同一天同一牙位多次拔牙
// =============================================================================
define "R17_MultipleExtractionsOnSameDay":
  [Procedure: "Extraction"] Extraction1
    with [Procedure: "Extraction"] Extraction2
      such that Extraction1.id != Extraction2.id
        and Extraction1.bodySite ~ Extraction2.bodySite
        and Extraction1.performed.start() same day as Extraction2.performed.start()
    return {
      tooth: Extraction1.bodySite,
      extractionDate: Extraction1.performed.start(),
      duplicateCount: 2,
      severity: 'ALERT',
      message: '⚠️ 注意：同一天同一牙位記錄多次拔牙，可能為重複記錄，請確認'
    }

// =============================================================================
// R18｜診斷輕度齲齒卻拔牙
// =============================================================================
define "R18_ExtractionForMildCaries":
  [Procedure: "Extraction"] ExtractionProc
    with [Condition] Diagnosis
      such that Diagnosis.bodySite ~ ExtractionProc.bodySite
        and Diagnosis.code ~ "Mild_Caries"
        and Diagnosis.onsetDateTime within 30 days of ExtractionProc.performed.start()
        and not exists([Condition] SevereCondition
          where SevereCondition.bodySite ~ ExtractionProc.bodySite
            and (SevereCondition.code ~ "Pulpitis" 
              or SevereCondition.code ~ "Apical_Disease"
              or SevereCondition.code ~ "Severe_Caries"))
    return {
      tooth: ExtractionProc.bodySite,
      diagnosis: Diagnosis.code,
      extractionDate: ExtractionProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：診斷為輕度齲齒卻拔牙，請確認是否有其他臨床理由（如：牙周病、外傷等）'
    }

// =============================================================================
// R19｜跨院牙位狀態不一致（拔除與治療）
// =============================================================================
define "R19_CrossClinicToothStatusConflict":
  [Procedure: "Extraction"] ExtractionProc
    with [Procedure] TreatmentProc
      such that TreatmentProc.bodySite ~ ExtractionProc.bodySite
        and TreatmentProc.code !~ "Extraction"
        and TreatmentProc.performed.start() after ExtractionProc.performed.start()
        and TreatmentProc.status = 'completed'
        and exists([Encounter] E1 where E1.id = Last(Split(ExtractionProc.encounter.reference, '/'))
          and exists([Encounter] E2 where E2.id = Last(Split(TreatmentProc.encounter.reference, '/'))
            and E1.serviceProvider.reference != E2.serviceProvider.reference))
    return {
      tooth: ExtractionProc.bodySite,
      extractionClinic: ExtractionProc.encounter,
      extractionDate: ExtractionProc.performed.start(),
      treatmentClinic: TreatmentProc.encounter,
      treatmentDate: TreatmentProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：跨院記錄不一致，其他院所記錄拔除後，本院又記錄治療，請確認牙位狀態'
    }

// =============================================================================
// R20｜同一牙位短期內重複補牙（7天內2次以上）
// =============================================================================
define "R20_RepeatedFillingInShortPeriod":
  [Procedure: "Filling"] Filling1
    let RecentFillings: [Procedure: "Filling"] Filling2
      where Filling2.bodySite ~ Filling1.bodySite
        and Filling2.performed.start() within 7 days of Filling1.performed.start()
        and Filling2.id != Filling1.id
    where Count(RecentFillings) >= 1
    return {
      tooth: Filling1.bodySite,
      fillingCount: Count(RecentFillings) + 1,
      firstDate: Min(RecentFillings.performed.start()),
      severity: 'ALERT',
      message: '⚠️ 注意：同一牙位7天內重複補牙' + ToString(Count(RecentFillings) + 1) + '次，請確認是否為填補物脫落或重複記錄'
    }

// =============================================================================
// R21｜植牙前無拔牙或缺牙記錄
// =============================================================================
define "R21_ImplantWithoutPriorExtraction":
  [Procedure: "Implant"] ImplantProc
    where not exists([Procedure: "Extraction"] ExtractionProc
      where ExtractionProc.bodySite ~ ImplantProc.bodySite
        and ExtractionProc.performed.start() before ImplantProc.performed.start())
    return {
      tooth: ImplantProc.bodySite,
      implantDate: ImplantProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：植牙前該牙位無拔牙記錄，請確認是否為先天缺牙或記錄遺漏'
    }

// =============================================================================
// R03｜根管治療期間又做根管第一次療程
// =============================================================================
define "R03_FirstRCTDuringOngoingRCT":
  [Procedure: "RCT_First"] FirstRCT1
    with [Procedure: "RCT_First"] FirstRCT2
      such that FirstRCT1.id != FirstRCT2.id
        and FirstRCT1.bodySite ~ FirstRCT2.bodySite
        and days between FirstRCT1.performed.start() and FirstRCT2.performed.start() <= 90
        and not exists([Procedure: "RCT_Filling"] FillingProc
          where FillingProc.bodySite ~ FirstRCT1.bodySite
            and FillingProc.performed.start() after FirstRCT1.performed.start()
            and FillingProc.performed.start() before FirstRCT2.performed.start())
    return {
      tooth: FirstRCT1.bodySite,
      firstDate: FirstRCT1.performed.start(),
      secondDate: FirstRCT2.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：根管治療進行中又記錄根管第一次療程，請確認是否為重新治療或重複記錄'
    }

// =============================================================================
// R06｜牙周治療於已拔除牙位
// =============================================================================
define "R06_PeriodontalTreatmentAfterExtraction":
  [Procedure: "Extraction"] ExtractionProc
    with [Procedure: "Periodontal_Treatment"] PerioProc
      such that PerioProc.bodySite ~ ExtractionProc.bodySite
        and PerioProc.performed.start() after ExtractionProc.performed.start()
        and PerioProc.status = 'completed'
    return {
      tooth: ExtractionProc.bodySite,
      extractionDate: ExtractionProc.performed.start(),
      perioDate: PerioProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：已拔除牙位不應進行牙周治療，請確認牙位是否正確'
    }

// =============================================================================
// R24｜根管充填後短期內又充填
// =============================================================================
define "R24_RepeatedRCTFillingInShortPeriod":
  [Procedure: "RCT_Filling"] Filling1
    with [Procedure: "RCT_Filling"] Filling2
      such that Filling1.id != Filling2.id
        and Filling1.bodySite ~ Filling2.bodySite
        and days between Filling1.performed.start() and Filling2.performed.start() <= 30
    return {
      tooth: Filling1.bodySite,
      firstFillingDate: Filling1.performed.start(),
      secondFillingDate: Filling2.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：根管充填完成後30天內又充填，請確認是否為重新治療或重複記錄'
    }

// =============================================================================
// 輔助函式
// =============================================================================

// 取得牙位字串表示
define function ToothPositionString(bodySite FHIR.CodeableConcept):
  if bodySite is null then null
  else Coalesce(bodySite.coding[0].display, bodySite.text)

// 計算日期差異
define function DaysBetween(start DateTime, end DateTime):
  difference in days between start and end

// 檢查是否為重大處置
define function IsMajorProcedure(procedureCode FHIR.CodeableConcept):
  procedureCode ~ "RCT" or procedureCode ~ "Extraction"

// 取得嚴重度等級
define function GetSeverityLevel(severity String):
  case severity
    when 'ALERT' then 1
    else 0
  end
