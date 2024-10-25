import { inject, injectable } from "inversify";
import path from "path";
import { container } from "../di/inversify.config";
import { TYPES } from "../di/types";
import { ResponseError } from "../error/response-error";
import { IReportBuilder } from "../interface/application/report-builder-interface";
import { IFileRecordRepository } from "../interface/repository/file-record-repository-interface";
import { IProjectRepository } from "../interface/repository/project-repository-interface";
import { IReportDetailRepository } from "../interface/repository/report-detail-repository-interface";
import { IReportRepository } from "../interface/repository/report-repository-interface";
import { IScenarioRepository } from "../interface/repository/scenario-repository-interface";
import { ITestCaseRepository } from "../interface/repository/testcase-repository-interface";
import { IToolRepository } from "../interface/repository/tool-repository-interface";
import { IReportService } from "../interface/service/report-service-interface";
import {
  FileRecordRequest,
  ReportDetailInsertRequest,
  ReportDetailRequest,
  ReportInsertRequest,
  ReportRequest,
} from "../model/model";
import { AuthUtil } from "../utils/auth-util";
import { FileSystem } from "../utils/file-system-util";
import { ReportValidation } from "../validation/report-validation";
import { Validation } from "../validation/validation";

@injectable()
export class ReportService implements IReportService {
  constructor(
    @inject(TYPES.IProjectRepository)
    private projectRepository: IProjectRepository,
    @inject(TYPES.IScenarioRepository)
    private scenarioRepository: IScenarioRepository,
    @inject(TYPES.ITestCaseRepository)
    private testCaseRepository: ITestCaseRepository,
    @inject(TYPES.IToolRepository) private toolRepository: IToolRepository,
    @inject(TYPES.IReportRepository)
    private reportRepository: IReportRepository,
    @inject(TYPES.IReportDetailRepository)
    private reportDetailRepository: IReportDetailRepository,
    @inject(TYPES.IFileRecordRepository)
    private fileRecordRepository: IFileRecordRepository
  ) {}

  public async createReport(reportRequest: ReportRequest): Promise<string> {
    const validatedRequest = Validation.validate(
      ReportValidation.reportSchema,
      reportRequest
    );

    // Project
    const project = await this.projectRepository.createOrGetProjectIdAndName(
      validatedRequest.project.toUpperCase()
    );

    // Scenario
    const scenario = await this.scenarioRepository.createOrGetScenarioIdAndName(
      validatedRequest.scenario.toUpperCase(),
      project.id
    );

    // TestCase
    const testCase = await this.testCaseRepository.createOrGetTestCaseIdAndName(
      validatedRequest.test_case.toUpperCase(),
      scenario.id
    );

    // Tool
    const toolId = await this.toolRepository.createOrGetToolId(
      validatedRequest.tool
    );

    const reportInsertRequest: ReportInsertRequest = {
      project_id: project.id,
      scenario_id: scenario.id,
      test_case_id: testCase.id,
      tool_id: toolId,
      activity: validatedRequest.activity,
      author: validatedRequest.author,
    };

    const result = await this.reportRepository.createReport(
      reportInsertRequest
    );
    return AuthUtil.signJwt(result);
  }

  public async addTestStep(
    reportDetailRequest: ReportDetailRequest
  ): Promise<void> {
    try {
      Validation.validate(
        ReportValidation.reportDetailSchema,
        reportDetailRequest
      );
    } catch (e: any) {
      const imagePath = process.env.IMAGE_PATH as string;
      await FileSystem.deleteFile(
        path.join(imagePath, reportDetailRequest.image)
      );
      throw e;
    }

    const reportDetailInsertRequest: ReportDetailInsertRequest = {
      report_id: reportDetailRequest.report_id,
      status_id: parseInt(reportDetailRequest.result, 10),
      title: reportDetailRequest.title,
      description: reportDetailRequest.description,
      image: reportDetailRequest.image as string,
    };

    await this.reportDetailRepository.createReportDetail(
      reportDetailInsertRequest
    );
  }

  public async saveReport(reportId: number): Promise<void> {
    const report = await this.reportRepository.getReportById(reportId);
    const reportDetails =
      await this.reportDetailRepository.findAllReportDetailByReportId(reportId);

    if (reportDetails.length < 1) {
      throw new ResponseError(400, "No Step Data Found");
    }

    const isReportFailed = reportDetails.some(
      (value) => value.status.name === "FAILED"
    );

    if (isReportFailed) {
      throw new ResponseError(
        400,
        "There is step data with failed status, please save the report with save-report-failed"
      );
    }

    const reportBuilder = container.get<IReportBuilder>(TYPES.IReportBuilder);

    const { fileName, date } = await reportBuilder.createReport(
      report,
      reportDetails
    );

    const fileRecordRequest: FileRecordRequest = {
      scenario_id: report.scenario.id,
      test_case_id: report.test_case.id,
      status_id: 2,
      file_name: fileName,
      created_time: date,
    };

    await this.fileRecordRepository.createFileRecord(fileRecordRequest);
    await this.reportDetailRepository.deleteAllReportDetailByReportId(reportId);
    await this.reportRepository.deleteReportById(reportId);

    const imagePath = process.env.IMAGE_PATH as string;
    for (const reportDetail of reportDetails) {
      await FileSystem.deleteFile(path.join(imagePath, reportDetail.image));
    }
  }

  async saveReportAsFailed(reportId: number): Promise<void> {
    const report = await this.reportRepository.getReportById(reportId);
    const reportDetails =
      await this.reportDetailRepository.findAllReportDetailByReportId(reportId);

    const reportBuilder = container.get<IReportBuilder>(TYPES.IReportBuilder);

    const { fileName, date } = await reportBuilder.createReport(
      report,
      reportDetails
    );

    const fileRecordRequest: FileRecordRequest = {
      scenario_id: report.scenario.id,
      test_case_id: report.test_case.id,
      status_id: 3,
      file_name: fileName,
      created_time: date,
    };

    await this.fileRecordRepository.createFileRecord(fileRecordRequest);
    await this.reportDetailRepository.deleteAllReportDetailByReportId(reportId);
    await this.reportRepository.deleteReportById(reportId);

    const imagePath = process.env.IMAGE_PATH as string;
    for (const reportDetail of reportDetails) {
      await FileSystem.deleteFile(path.join(imagePath, reportDetail.image));
    }
  }
}
