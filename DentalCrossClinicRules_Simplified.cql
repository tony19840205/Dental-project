library DentalCrossClinicRules version '2.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

codesystem "SNOMED-CT": 'http://snomed.info/sct'
codesystem "DentalProcedureCodes": 'http://example.org/fhir/dental-procedures'
codesystem "DentalDiagnosisCodes": 'http://example.org/fhir/dental-diagnosis'

// 定義牙科處置代碼
code "Extraction": '129304002' from "SNOMED-CT" display '拔牙'
code "Extraction_Code": 'EXTRACTION' from "DentalProcedureCodes" display '拔牙'
code "RCT_First": 'RCT-FIRST' from "DentalProcedureCodes" display '根管第一次療程'
code "RCT": '234567' from "SNOMED-CT" display '根管治療'
code "RCT_Cleaning": 'RCT-CLEAN' from "DentalProcedureCodes" display '根管清創'
code "RCT_Filling": 'RCT-FILL' from "DentalProcedureCodes" display '根管充填'
code "Filling": '234568' from "SNOMED-CT" display '補牙'
code "Filling_Code": 'FILLING' from "DentalProcedureCodes" display '補牙'
code "Implant": 'IMPLANT' from "DentalProcedureCodes" display '植牙'
code "Implant_Placement": 'IMPLANT-PLACEMENT' from "DentalProcedureCodes" display '植牙手術'
code "Crown": 'CROWN' from "DentalProcedureCodes" display '牙冠/假牙'

// 定義診斷代碼
code "Mild_Caries": 'CARIES-MILD' from "DentalDiagnosisCodes" display '輕度齲齒'
code "Moderate_Caries": 'CARIES-MOD' from "DentalDiagnosisCodes" display '中度齲齒'
code "Severe_Caries": 'CARIES-SEV' from "DentalDiagnosisCodes" display '重度齲齒'
code "Pulpitis": 'PULPITIS' from "DentalDiagnosisCodes" display '牙髓炎'
code "Apical_Disease": 'APICAL-DIS' from "DentalDiagnosisCodes" display '根尖病變'
code "Missing_Tooth": 'MISSING-TOOTH' from "DentalDiagnosisCodes" display '缺牙'

context Patient

// =============================================================================
// 🔴 R01｜同一就診：輕度齲齒卻進行拔牙
// 嚴重度：🟡 中（建議補充診斷）
// =============================================================================
define "R01_MildCariesWithExtraction":
  [Encounter] Enc
    let Conditions: [Condition] C where C.encounter.reference = 'Encounter/' + Enc.id,
        Procedures: [Procedure] P where P.encounter.reference = 'Encounter/' + Enc.id
    where exists(
      from Conditions C, Procedures P
      where C.bodySite.exists() and P.bodySite.exists()
        and First(C.bodySite).coding.exists(c => First(P.bodySite).coding.exists(pc => c.code = pc.code))
        and C.code ~ "Mild_Caries"
        and (P.code ~ "Extraction" or P.code ~ "Extraction_Code")
    )
    return {
      encounter: Enc.id,
      tooth: First(
        from Conditions C, Procedures P
        where C.bodySite.exists() and P.bodySite.exists()
          and First(C.bodySite).coding.exists(c => First(P.bodySite).coding.exists(pc => c.code = pc.code))
          and C.code ~ "Mild_Caries"
          and (P.code ~ "Extraction" or P.code ~ "Extraction_Code")
        return First(P.bodySite).coding.first().code
      ),
      diagnosis: 'Mild_Caries',
      procedure: 'Extraction',
      severity: 'WARNING',
      message: '⚠️ 注意：診斷為輕度齲齒但進行拔牙，建議補充重度齲齒或其他嚴重診斷'
    }

// =============================================================================
// 🟡 R02｜同一就診：輕度/中度齲齒卻進行根管治療
// 嚴重度：🟡 中（建議補充診斷）
// =============================================================================
define "R02_MildCariesWithRCT":
  [Encounter] Enc
    let Conditions: [Condition] C where C.encounter.reference = 'Encounter/' + Enc.id,
        Procedures: [Procedure] P where P.encounter.reference = 'Encounter/' + Enc.id
    where exists(
      from Conditions C, Procedures P
      where C.bodySite.exists() and P.bodySite.exists()
        and First(C.bodySite).coding.exists(c => First(P.bodySite).coding.exists(pc => c.code = pc.code))
        and (C.code ~ "Mild_Caries" or C.code ~ "Moderate_Caries")
        and (P.code ~ "RCT" or P.code ~ "RCT_First" or P.code ~ "RCT_Cleaning" or P.code ~ "RCT_Filling")
        and not exists(Conditions SevereC 
          where SevereC.bodySite.exists()
            and First(SevereC.bodySite).coding.exists(sc => First(P.bodySite).coding.exists(pc => sc.code = pc.code))
            and (SevereC.code ~ "Pulpitis" or SevereC.code ~ "Apical_Disease" or SevereC.code ~ "Severe_Caries"))
    )
    return {
      encounter: Enc.id,
      tooth: First(
        from Conditions C, Procedures P
        where C.bodySite.exists() and P.bodySite.exists()
          and First(C.bodySite).coding.exists(c => First(P.bodySite).coding.exists(pc => c.code = pc.code))
          and (C.code ~ "Mild_Caries" or C.code ~ "Moderate_Caries")
          and (P.code ~ "RCT" or P.code ~ "RCT_First" or P.code ~ "RCT_Cleaning" or P.code ~ "RCT_Filling")
        return First(P.bodySite).coding.first().code
      ),
      currentDiagnosis: First(
        from Conditions C, Procedures P
        where C.bodySite.exists() and P.bodySite.exists()
          and First(C.bodySite).coding.exists(c => First(P.bodySite).coding.exists(pc => c.code = pc.code))
          and (C.code ~ "Mild_Caries" or C.code ~ "Moderate_Caries")
          and (P.code ~ "RCT" or P.code ~ "RCT_First" or P.code ~ "RCT_Cleaning" or P.code ~ "RCT_Filling")
        return C.code.coding.first().display
      ),
      procedure: 'RCT',
      severity: 'WARNING',
      message: '⚠️ 注意：目前診斷為輕度/中度齲齒，建議補登牙髓炎或根尖病變診斷以支持根管治療'
    }

// =============================================================================
// 🔴 R03｜同一就診：處置和診斷的牙位不匹配
// 嚴重度：🔴 高（資料品質問題）
// 說明：檢查每個處置是否有對應牙位的診斷（允許一次就診處理多顆牙）
// =============================================================================
define "R03_InconsistentToothPositionInEncounter":
  [Procedure] Proc
    where Proc.encounter.exists() and Proc.bodySite.exists()
      and exists(
        [Condition] Cond
        where Cond.encounter.reference = Proc.encounter.reference
          and Cond.bodySite.exists()
      )
      and not exists(
        [Condition] MatchingCond
        where MatchingCond.encounter.reference = Proc.encounter.reference
          and MatchingCond.bodySite.exists()
          and First(MatchingCond.bodySite).coding.exists(c => 
            First(Proc.bodySite).coding.exists(p => c.code = p.code))
      )
    return {
      encounter: Last(Split(Proc.encounter.reference, '/')),
      procedureTooth: First(Proc.bodySite).coding.first().code,
      procedureType: Proc.code.coding.first().display,
      availableDiagnosisTeeth: distinct (
        [Condition] C 
        where C.encounter.reference = Proc.encounter.reference 
          and C.bodySite.exists()
        return First(C.bodySite).coding.first().code
      ),
      severity: 'ALERT',
      message: '⚠️ 注意：處置的牙位沒有對應的診斷記錄，請檢查牙位標記或補充診斷'
    }

// =============================================================================
// 🔴 R04｜歷史驗證：已拔除的牙位又被處置
// 嚴重度：🔴 高（不可能的處置）
// =============================================================================
define "R04_ExtractedToothRetreated":
  [Procedure] CurrentProc
    where CurrentProc.bodySite.exists()
      and not (CurrentProc.code ~ "Extraction" or CurrentProc.code ~ "Extraction_Code")
      and exists(
        [Procedure] PreviousExtraction
        where PreviousExtraction.bodySite.exists()
          and First(PreviousExtraction.bodySite).coding.exists(pe => 
            First(CurrentProc.bodySite).coding.exists(cp => pe.code = cp.code))
          and (PreviousExtraction.code ~ "Extraction" or PreviousExtraction.code ~ "Extraction_Code")
          and PreviousExtraction.performed.start() < CurrentProc.performed.start()
          and PreviousExtraction.status = 'completed'
      )
    return {
      tooth: First(CurrentProc.bodySite).coding.first().code,
      extractionDate: First(
        [Procedure] PreviousExtraction
        where PreviousExtraction.bodySite.exists()
          and First(PreviousExtraction.bodySite).coding.exists(pe => 
            First(CurrentProc.bodySite).coding.exists(cp => pe.code = cp.code))
          and (PreviousExtraction.code ~ "Extraction" or PreviousExtraction.code ~ "Extraction_Code")
          and PreviousExtraction.performed.start() < CurrentProc.performed.start()
        return PreviousExtraction.performed.start()
      ),
      currentProcedure: CurrentProc.code.coding.first().display,
      currentDate: CurrentProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：此牙位已拔除，不應再進行治療處置'
    }

// =============================================================================
// 🔴 R05｜歷史驗證：植牙位置又進行根管治療
// 嚴重度：🔴 高（不可能的處置）
// =============================================================================
define "R05_ImplantFollowedByRCT":
  [Procedure] CurrentProc
    where CurrentProc.bodySite.exists()
      and (CurrentProc.code ~ "RCT" or CurrentProc.code ~ "RCT_First" 
        or CurrentProc.code ~ "RCT_Cleaning" or CurrentProc.code ~ "RCT_Filling")
      and exists(
        [Procedure] PreviousImplant
        where PreviousImplant.bodySite.exists()
          and First(PreviousImplant.bodySite).coding.exists(pi => 
            First(CurrentProc.bodySite).coding.exists(cp => pi.code = cp.code))
          and (PreviousImplant.code ~ "Implant" or PreviousImplant.code ~ "Implant_Placement")
          and PreviousImplant.performed.start() < CurrentProc.performed.start()
          and PreviousImplant.status = 'completed'
      )
    return {
      tooth: First(CurrentProc.bodySite).coding.first().code,
      implantDate: First(
        [Procedure] PreviousImplant
        where PreviousImplant.bodySite.exists()
          and First(PreviousImplant.bodySite).coding.exists(pi => 
            First(CurrentProc.bodySite).coding.exists(cp => pi.code = cp.code))
          and (PreviousImplant.code ~ "Implant" or PreviousImplant.code ~ "Implant_Placement")
        return PreviousImplant.performed.start()
      ),
      currentProcedure: CurrentProc.code.coding.first().display,
      currentDate: CurrentProc.performed.start(),
      severity: 'ALERT',
      message: '⚠️ 注意：植體無牙髓組織，不應進行根管治療，請確認牙位是否正確'
    }

// =============================================================================
// 🟡 R06｜同一就診：有處置但無相應診斷
// 嚴重度：🟡 中（記錄完整性）
// =============================================================================
define "R06_ProcedureWithoutDiagnosis":
  [Encounter] Enc
    let Conditions: [Condition] C where C.encounter.reference = 'Encounter/' + Enc.id,
        Procedures: [Procedure] P where P.encounter.reference = 'Encounter/' + Enc.id and P.bodySite.exists()
    where exists(
      from Procedures P
      where not exists(
        from Conditions C
        where C.bodySite.exists()
          and First(C.bodySite).coding.exists(c => First(P.bodySite).coding.exists(p => c.code = p.code))
      )
      return P
    )
    return {
      encounter: Enc.id,
      procedureTeeth: distinct (
        from Procedures P
        where not exists(
          from Conditions C
          where C.bodySite.exists()
            and First(C.bodySite).coding.exists(c => First(P.bodySite).coding.exists(p => c.code = p.code))
        )
        return First(P.bodySite).coding.first().code
      ),
      severity: 'INFO',
      message: '💡 建議：有處置記錄但無相應的診斷，建議補充診斷記錄'
    }

// =============================================================================
// 🔴 R07｜跨院所重複記錄「根管第一次療程」
// 嚴重度：🔴 高（可能重複治療或記錄錯誤）
// =============================================================================
define "R07_DuplicateFirstRCTAcrossClinics":
  [Procedure: "RCT_First"] FirstRCT
    where FirstRCT.bodySite.exists()
      and exists(
        [Procedure: "RCT_First"] OtherRCT
        where OtherRCT.id != FirstRCT.id
          and OtherRCT.bodySite.exists()
          and First(OtherRCT.bodySite).coding.exists(o => 
            First(FirstRCT.bodySite).coding.exists(f => o.code = f.code))
          and OtherRCT.encounter.reference != FirstRCT.encounter.reference
          and exists(
            [Encounter] E1 where E1.id = Last(Split(FirstRCT.encounter.reference, '/'))
            where exists(
              [Encounter] E2 where E2.id = Last(Split(OtherRCT.encounter.reference, '/'))
              where E1.serviceProvider.reference != E2.serviceProvider.reference
            )
          )
      )
    return {
      tooth: First(FirstRCT.bodySite).coding.first().code,
      currentClinic: First(
        [Encounter] E where E.id = Last(Split(FirstRCT.encounter.reference, '/'))
        return E.serviceProvider.reference
      ),
      currentDate: FirstRCT.performed.start(),
      otherClinic: First(
        [Procedure: "RCT_First"] OtherRCT
        where OtherRCT.id != FirstRCT.id
          and OtherRCT.bodySite.exists()
          and First(OtherRCT.bodySite).coding.exists(o => 
            First(FirstRCT.bodySite).coding.exists(f => o.code = f.code))
        return First(
          [Encounter] E where E.id = Last(Split(OtherRCT.encounter.reference, '/'))
          return E.serviceProvider.reference
        )
      ),
      otherDate: First(
        [Procedure: "RCT_First"] OtherRCT
        where OtherRCT.id != FirstRCT.id
          and OtherRCT.bodySite.exists()
          and First(OtherRCT.bodySite).coding.exists(o => 
            First(FirstRCT.bodySite).coding.exists(f => o.code = f.code))
        return OtherRCT.performed.start()
      ),
      severity: 'ALERT',
      message: '⚠️ 注意：此牙位已於其他院所記錄「根管第一次療程」，請確認是否為續療或重新治療'
    }

// =============================================================================
// 🔴 R08｜植牙牙位卻診斷為蛀牙
// 嚴重度：🔴 高（邏輯矛盾）
// =============================================================================
define "R08_ImplantWithCariesDiagnosis":
  [Condition] Cond
    where Cond.bodySite.exists()
      and (Cond.code ~ "Caries_Mild" or Cond.code ~ "Caries_Moderate" or Cond.code ~ "Caries_Severe")
      and exists(
        [Procedure] PreviousImplant
        where PreviousImplant.bodySite.exists()
          and First(PreviousImplant.bodySite).coding.exists(pi => 
            First(Cond.bodySite).coding.exists(c => c.code = pi.code))
          and (PreviousImplant.code ~ "Implant" or PreviousImplant.code ~ "Implant_Placement")
          and PreviousImplant.performed.start() < Cond.onset.start()
          and PreviousImplant.status = 'completed'
      )
    return {
      tooth: First(Cond.bodySite).coding.first().code,
      diagnosis: Cond.code.coding.first().display,
      diagnosisDate: Cond.onset.start(),
      implantDate: First(
        [Procedure] PreviousImplant
        where PreviousImplant.bodySite.exists()
          and First(PreviousImplant.bodySite).coding.exists(pi => 
            First(Cond.bodySite).coding.exists(c => c.code = pi.code))
          and (PreviousImplant.code ~ "Implant" or PreviousImplant.code ~ "Implant_Placement")
        return PreviousImplant.performed.start()
      ),
      severity: 'ALERT',
      message: '⚠️ 注意：植體不會蛀牙，請確認牙位是否正確或診斷是否誤植'
    }

// =============================================================================
// 彙總所有警告
// =============================================================================
define "AllAlerts":
  R01_MildCariesWithExtraction
    union R02_MildCariesWithRCT
    union R03_InconsistentToothPositionInEncounter
    union R04_ExtractedToothRetreated
    union R05_ImplantFollowedByRCT
    union R06_ProcedureWithoutDiagnosis
    union R07_DuplicateFirstRCTAcrossClinics
    union R08_ImplantWithCariesDiagnosis
